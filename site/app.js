// Internship Finder — front end. Reads data/listings.json (written by the daily
// refresh) and keeps Saved / Applied marks in this browser's localStorage, keyed by
// each listing's stable id so they survive every refresh.

const STATUS_KEY = 'internship-finder:statuses:v1';
const FILTER_KEY = 'internship-finder:filters:v1';
const NEW_DAYS = 3;
const TZ = 'America/New_York';

const SECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'Marketing', label: 'Marketing' },
  { id: 'Social Media', label: 'Social Media' },
  { id: 'Brand Marketing', label: 'Brand Marketing' },
  { id: 'Sales', label: 'Sales' },
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
];

const $ = sel => document.querySelector(sel);
const els = {
  tabs: $('#tabs'), list: $('#list'), empty: $('#empty'), count: $('#count'),
  search: $('#search'), chips: $('#industryChips'), location: $('#locationFilter'), term: $('#termFilter'),
  hideApplied: $('#hideApplied'), clear: $('#clearFilters'), refresh: $('#refreshLine'), regions: $('#regionsLine'),
  tpl: $('#cardTpl'), exportBtn: $('#exportBtn'), importInput: $('#importInput'),
  sourcesSummary: $('#sourcesSummary'), sourceProblems: $('#sourceProblems'),
};

let data = { listings: [], config: { industryFilters: [], regions: [] } };
let statuses = loadJson(STATUS_KEY, {});
const defaults = { section: 'all', q: '', industry: '', location: '', term: '', hideApplied: false };
let filters = { ...defaults, ...loadJson(FILTER_KEY, {}) };

// ── storage (wrapped: private mode / blocked storage must not break the page) ──
function loadJson(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// ── formatting ──
const fmtDate = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateTime = iso => new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const daysAgo = iso => (Date.now() - new Date(iso).getTime()) / 864e5;
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const roleClass = r => 'role-' + r.toLowerCase().replace(/[^a-z]+/g, '-');

function termRank(t) {
  const m = /^(Spring|Summer|Fall|Winter) (\d{4})$/.exec(t);
  if (t === 'Summer 2027') return -1e6; // the main target goes first
  if (m) return Number(m[2]) * 10 + { Winter: 0, Spring: 1, Summer: 2, Fall: 3 }[m[1]];
  if (/season not stated/.test(t)) return 1e6;
  if (/Year-round/.test(t)) return 2e6;
  return 3e6;
}

// ── data ──
async function load() {
  try {
    const res = await fetch('data/listings.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    els.refresh.textContent = 'Could not load listings. Try reloading the page.';
    console.error(err);
    return;
  }
  buildControls();
  render();
}

function buildControls() {
  // Header
  const regions = data.config?.regions || [];
  if (regions.length) els.regions.textContent = regions.map(r => r.label).join(' · ');
  if (data.lastSuccessfulRefresh) {
    els.refresh.innerHTML = '';
    els.refresh.append('Last successful refresh: ');
    const s = document.createElement('strong');
    s.textContent = fmtDateTime(data.lastSuccessfulRefresh);
    els.refresh.append(s);
  }

  // Tabs
  els.tabs.innerHTML = '';
  for (const sec of SECTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.role = 'tab';
    b.dataset.section = sec.id;
    b.textContent = sec.label;
    const n = document.createElement('span');
    n.className = 'n';
    b.append(n);
    b.addEventListener('click', () => { filters.section = sec.id; persist(); render(); });
    els.tabs.append(b);
  }

  // Industry chips
  els.chips.innerHTML = '';
  for (const ind of ['', ...(data.config?.industryFilters || [])]) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.dataset.industry = ind;
    c.textContent = ind || 'All industries';
    c.addEventListener('click', () => { filters.industry = ind; persist(); render(); });
    els.chips.append(c);
  }

  // Location select
  for (const r of regions) els.location.add(new Option(r.label, r.id));

  // Term select — built from the terms present in the data
  const terms = [...new Set(data.listings.map(l => l.term))].sort((a, b) => termRank(a) - termRank(b) || a.localeCompare(b));
  for (const t of terms) els.term.add(new Option(t, t));
  if (filters.term && !terms.includes(filters.term)) filters.term = '';

  // Sources summary
  const src = Object.values(data.sources || {});
  const bad = src.filter(s => !s.ok);
  els.sourcesSummary.textContent = `${data.sourcesOk ?? src.length - bad.length} of ${data.sourcesTotal ?? src.length} employer job boards refreshed successfully on the last run. Listings come straight from each employer's own job board (Greenhouse, Lever, Ashby, SmartRecruiters).`;
  els.sourceProblems.innerHTML = '';
  for (const s of bad) {
    const li = document.createElement('li');
    li.textContent = `${s.employer}: ${s.error || 'unavailable'} — showing results from ${s.lastSuccess ? fmtDate(s.lastSuccess) : 'the last good run'}.`;
    els.sourceProblems.append(li);
  }
  if (bad.length) {
    const note = document.createElement('span');
    note.textContent = ` · ${bad.length} source${bad.length > 1 ? 's' : ''} using older data`;
    els.refresh.append(note);
  }

  // Inputs
  els.search.value = filters.q;
  els.location.value = filters.location;
  els.term.value = filters.term;
  els.hideApplied.checked = filters.hideApplied;
  let t;
  els.search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { filters.q = els.search.value; persist(); render(); }, 120); });
  els.location.addEventListener('change', () => { filters.location = els.location.value; persist(); render(); });
  els.term.addEventListener('change', () => { filters.term = els.term.value; persist(); render(); });
  els.hideApplied.addEventListener('change', () => { filters.hideApplied = els.hideApplied.checked; persist(); render(); });
  els.clear.addEventListener('click', () => {
    filters = { ...defaults, section: filters.section };
    els.search.value = ''; els.location.value = ''; els.term.value = ''; els.hideApplied.checked = false;
    persist(); render();
  });
}

function persist() { saveJson(FILTER_KEY, filters); }

// ── statuses ──
function getStatus(id) { return statuses[id] || {}; }
function setStatus(listing, patch) {
  const cur = { ...getStatus(listing.id), ...patch };
  // Keep a small snapshot so a saved listing stays visible even after it disappears from the data.
  cur.snapshot = { title: listing.title, company: listing.company, applyUrl: listing.applyUrl, locations: listing.locations, term: listing.term, roles: listing.roles, industries: listing.industries };
  if (!cur.saved && !cur.applied) delete statuses[listing.id];
  else statuses[listing.id] = cur;
  saveJson(STATUS_KEY, statuses);
}

// ── filtering ──
function matchesSearch(l, q) {
  if (!q) return true;
  const hay = [l.title, l.company, ...(l.roles || []), ...(l.industries || []), l.term, ...(l.locations || []), l.description || ''].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

function baseFilter(l, { ignoreSection = false } = {}) {
  if (filters.industry && !(l.industries || []).includes(filters.industry)) return false;
  if (filters.location && !(l.regions || []).includes(filters.location)) return false;
  if (filters.term && l.term !== filters.term) return false;
  if (!matchesSearch(l, filters.q)) return false;
  return ignoreSection || true;
}

function listingsForSection(section) {
  const byId = new Map(data.listings.map(l => [l.id, l]));
  if (section === 'saved' || section === 'applied') {
    const out = [];
    for (const [id, st] of Object.entries(statuses)) {
      if (section === 'saved' ? !st.saved : !st.applied) continue;
      const l = byId.get(id) || { id, ...st.snapshot, regions: [], status: 'gone', missing: true };
      out.push(l);
    }
    return out.filter(l => baseFilter(l)).sort(sortNewest);
  }
  return data.listings
    .filter(l => l.status === 'active')
    .filter(l => section === 'all' || (l.roles || []).includes(section))
    .filter(l => !(filters.hideApplied && getStatus(l.id).applied))
    .filter(l => baseFilter(l))
    .sort(sortNewest);
}

function sortNewest(a, b) {
  const da = a.postedAt || a.firstSeenAt || '';
  const db = b.postedAt || b.firstSeenAt || '';
  return db.localeCompare(da) || String(a.title).localeCompare(String(b.title));
}

// ── rendering ──
function render() {
  for (const b of els.tabs.children) {
    const sec = b.dataset.section;
    b.setAttribute('aria-selected', String(sec === filters.section));
    b.querySelector('.n').textContent = listingsForSection(sec).length;
  }
  for (const c of els.chips.children) c.setAttribute('aria-pressed', String(c.dataset.industry === filters.industry));

  const items = listingsForSection(filters.section);
  els.list.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const l of items) frag.append(renderCard(l));
  els.list.append(frag);

  const secLabel = SECTIONS.find(s => s.id === filters.section)?.label || 'All';
  els.count.textContent = `${items.length} ${items.length === 1 ? 'internship' : 'internships'}${filters.section === 'all' ? '' : ` · ${secLabel}`}${filters.industry ? ` · ${filters.industry}` : ''} · newest first`;
  els.empty.hidden = items.length > 0;
  if (!items.length) {
    els.empty.textContent = filters.section === 'saved' ? 'Nothing saved yet. Tap “Save” on any internship to keep it here.'
      : filters.section === 'applied' ? 'Nothing marked as applied yet.'
      : 'No internships match these filters right now. Try clearing a filter — new listings are added every morning.';
  }
}

function renderCard(l) {
  const node = els.tpl.content.firstElementChild.cloneNode(true);
  const st = getStatus(l.id);
  const closed = l.status === 'closed' || l.missing;
  if (closed) node.classList.add('is-closed');
  node.dataset.id = l.id;

  node.querySelector('.title').textContent = l.title || 'Untitled';
  node.querySelector('.company').textContent = l.company || '';

  const badges = node.querySelector('.badges');
  const addBadge = (cls, text) => { const s = document.createElement('span'); s.className = `badge ${cls}`; s.textContent = text; badges.append(s); };
  if (closed) addBadge('closed', l.missing ? 'No longer listed' : 'Closed');
  else if (daysAgo(l.postedAt || l.firstSeenAt) <= NEW_DAYS) addBadge('new', 'New');
  if (st.applied) addBadge('is-applied', 'Applied');

  // Location + date line
  const meta = node.querySelector('.meta');
  const loc = (l.locations || []).join(' · ') || 'Location unavailable';
  const wp = l.workplace === 'hybrid' ? ' (hybrid)' : l.workplace === 'on-site' ? ' (on-site)' : '';
  meta.append(loc + wp);
  const dateSpan = document.createElement('span');
  if (l.postedAt) {
    dateSpan.textContent = `Posted ${fmtDate(l.postedAt)}`;
  } else if (l.firstSeenAt) {
    dateSpan.className = 'date-note';
    dateSpan.textContent = `First found ${fmtDate(l.firstSeenAt)} (posting date not provided)`;
  }
  if (dateSpan.textContent) {
    const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '·';
    meta.append(sep, dateSpan);
  }

  // Tags
  const tags = node.querySelector('.tags');
  const addTag = (cls, text, title) => { const s = document.createElement('span'); s.className = `tag ${cls}`; s.textContent = text; if (title) s.title = title; tags.append(s); };
  if (l.term) addTag('term', l.termInferred ? `${l.term} (likely)` : l.term, l.termInferred ? 'The posting does not state the year; estimated from the season and posting date.' : '');
  for (const r of l.roles || []) addTag(roleClass(r), r);
  for (const i of l.industries || []) addTag('industry', i);

  // Facts
  const facts = node.querySelector('.facts');
  const addFact = (label, value) => {
    if (!value || (Array.isArray(value) && !value.length)) return;
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd');
    if (Array.isArray(value)) {
      const ul = document.createElement('ul');
      for (const v of value) { const li = document.createElement('li'); li.textContent = v; ul.append(li); }
      dd.append(ul);
    } else dd.textContent = value;
    facts.append(dt, dd);
  };
  addFact('Pay', l.pay);
  addFact('Eligibility', l.eligibility);
  if (st.applied && st.appliedAt) addFact('You applied', fmtDate(st.appliedAt));
  if (l.status === 'closed' && l.closedAt) addFact('Closed', `Removed from the employer's job board on ${fmtDate(l.closedAt)}`);

  // Actions
  const apply = node.querySelector('.apply');
  const url = safeUrl(l.applyUrl);
  if (url && !closed) {
    apply.href = url;
    apply.textContent = 'Apply';
    apply.setAttribute('aria-label', `Apply: ${l.title} at ${l.company} (opens employer site)`);
  } else {
    apply.removeAttribute('href');
    apply.setAttribute('aria-disabled', 'true');
    apply.textContent = closed ? 'No longer accepting' : 'No link';
  }

  const save = node.querySelector('.actions .save');
  save.setAttribute('aria-pressed', String(!!st.saved));
  save.textContent = st.saved ? '★ Saved' : '☆ Save';
  save.addEventListener('click', () => { setStatus(l, { saved: !getStatus(l.id).saved }); render(); });

  const appliedBtn = node.querySelector('.actions .applied');
  appliedBtn.setAttribute('aria-pressed', String(!!st.applied));
  appliedBtn.textContent = st.applied ? '✓ Applied' : 'Mark applied';
  appliedBtn.addEventListener('click', () => {
    const now = !getStatus(l.id).applied;
    setStatus(l, { applied: now, appliedAt: now ? new Date().toISOString() : null });
    render();
  });

  // Extra office-specific apply links when one internship is posted for several offices
  const more = node.querySelector('.more-links');
  const links = (l.applyLinks || []).filter(x => safeUrl(x.url) && x.url !== l.applyUrl);
  if (links.length && !closed) {
    more.append('Also posted for: ');
    for (const x of links) {
      const a = document.createElement('a');
      a.href = safeUrl(x.url); a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = x.label || 'another office';
      more.append(a);
    }
  } else more.remove();

  return node;
}

// ── export / import ──
els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), statuses }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `internship-list-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed.statuses || parsed;
    if (typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('bad file');
    let n = 0;
    for (const [id, st] of Object.entries(incoming)) {
      if (!st || typeof st !== 'object') continue;
      const cur = statuses[id] || {};
      statuses[id] = { ...cur, ...st, saved: !!(cur.saved || st.saved), applied: !!(cur.applied || st.applied) };
      n++;
    }
    saveJson(STATUS_KEY, statuses);
    render();
    alert(`Imported ${n} saved/applied internship${n === 1 ? '' : 's'}.`);
  } catch {
    alert('That file could not be imported. Choose a file made with “Export my list”.');
  }
  els.importInput.value = '';
});

load();
