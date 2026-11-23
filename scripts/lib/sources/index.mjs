// Source adapters. Each returns an array of normalized raw jobs:
// {
//   sourceJobId, title, company, url (posting page), applyUrl,
//   locations: Array<string | {city, state, remote, hybrid, text}>,
//   workplaceType: 'remote'|'hybrid'|'onsite'|'' ,
//   employmentType, text (plain-text description), postedAt (ISO|null),
//   pay (string|null — when the source gives structured pay), closed (bool)
// }
// Each adapter throws on any network/API failure so the caller keeps the last
// good results for that employer.
import { htmlToText, toIso, squish } from '../text.mjs';

const UA = 'internship-finder/1.0 (personal job search; daily)';

export async function getJson(url, { retries = 2, timeoutMs = 30000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) throw Object.assign(new Error(`404 Not Found — check the board id (${url})`), { permanent: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (err.permanent) break;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

const looksIntern = t => /\b(intern|interns|internship|co-?op|summer analyst|summer program)\b/i.test(t || '');

// ── Greenhouse ──────────────────────────────────────────────────────────────
// https://developers.greenhouse.io/job-board.html
async function greenhouse(emp) {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(emp.board)}/jobs?content=true`);
  if (!Array.isArray(data.jobs)) throw new Error('Unexpected Greenhouse response');
  return data.jobs.map(j => {
    const locs = [j.location?.name].filter(Boolean);
    for (const o of j.offices || []) if (o.location || o.name) locs.push(o.location || o.name);
    const metaList = (j.metadata || []).filter(m => m.value != null && m.value !== '' && !(Array.isArray(m.value) && !m.value.length));
    const meta = Object.fromEntries(metaList.map(m => [String(m.name || '').toLowerCase(), Array.isArray(m.value) ? m.value.join(', ') : String(m.value)]));
    const pick = re => Object.entries(meta).find(([k]) => re.test(k))?.[1] || '';
    const wt = pick(/workplace|remote|location type/);
    const et = pick(/employment|job type|time type/);
    const minPay = pick(/^min(imum)? (salary|pay|compensation)/);
    const maxPay = pick(/^max(imum)? (salary|pay|compensation)/);
    const metaText = metaList.filter(m => !/salary|event|workday|eeo/i.test(m.name)).map(m => `${m.name}: ${meta[String(m.name).toLowerCase()]}`).join('\n');
    const text = [htmlToText(j.content || ''), metaText].filter(Boolean).join('\n');
    const toNum = v => Number(String(v).replace(/[^0-9.]/g, '')) || null;
    return {
      sourceJobId: String(j.id),
      title: squish(j.title),
      company: emp.name,
      url: j.absolute_url,
      applyUrl: j.absolute_url,
      // Greenhouse "offices" often list a parent region ("Americas"); the location name is primary.
      locations: j.location?.name ? [j.location.name] : locs,
      workplaceType: wt,
      employmentType: et,
      text,
      postedAt: toIso(j.first_published) || null,
      pay: minPay || maxPay ? fmtRange(toNum(minPay), toNum(maxPay), 'USD', toNum(minPay || maxPay) > 1000 ? 'year' : '') : null,
      closed: false,
    };
  });
}

// ── Lever ───────────────────────────────────────────────────────────────────
// https://github.com/lever/postings-api
async function lever(emp) {
  const data = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(emp.board)}?mode=json`);
  if (!Array.isArray(data)) throw new Error('Unexpected Lever response');
  return data.map(j => {
    const lists = (j.lists || []).map(l => `${l.text}\n${htmlToText(l.content || '')}`).join('\n');
    const text = [j.descriptionPlain || htmlToText(j.description || ''), lists, j.additionalPlain || ''].join('\n');
    const c = j.categories || {};
    const sr = j.salaryRange;
    const pay = sr ? fmtRange(sr.min, sr.max, sr.currency, sr.interval) : null;
    return {
      sourceJobId: j.id,
      title: squish(j.text),
      company: emp.name,
      url: j.hostedUrl,
      applyUrl: j.applyUrl || j.hostedUrl,
      locations: c.allLocations?.length ? c.allLocations : [c.location].filter(Boolean),
      workplaceType: j.workplaceType || '',
      employmentType: c.commitment || '',
      text,
      postedAt: toIso(j.createdAt),
      pay,
      closed: false,
    };
  });
}

// ── Ashby ───────────────────────────────────────────────────────────────────
// https://developers.ashbyhq.com/docs/public-job-posting-api
async function ashby(emp) {
  const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(emp.board)}?includeCompensation=true`);
  if (!Array.isArray(data.jobs)) throw new Error('Unexpected Ashby response');
  return data.jobs.filter(j => j.isListed !== false).map(j => {
    const addr = a => a?.postalAddress ? { city: a.postalAddress.addressLocality, state: a.postalAddress.addressRegion, text: [a.postalAddress.addressLocality, a.postalAddress.addressRegion].filter(Boolean).join(', ') } : null;
    const locations = [];
    const primary = addr(j.address);
    locations.push(primary && primary.city ? primary : j.location);
    for (const s of j.secondaryLocations || []) {
      const a = addr(s.address);
      locations.push(a && a.city ? a : s.location);
    }
    const comp = j.compensation?.compensationTierSummary || j.compensation?.scrapeableCompensationSalarySummary || null;
    return {
      sourceJobId: j.id,
      title: squish(j.title),
      company: emp.name,
      url: j.jobUrl,
      applyUrl: j.applyUrl || j.jobUrl,
      locations: locations.filter(Boolean),
      // Ashby sets isRemote=true on hybrid jobs too; workplaceType is the reliable field.
      workplaceType: j.workplaceType || (j.isRemote ? 'remote' : ''),
      employmentType: j.employmentType || '',
      text: j.descriptionPlain || htmlToText(j.descriptionHtml || ''),
      postedAt: toIso(j.publishedAt),
      pay: comp,
      closed: false,
    };
  });
}

// ── SmartRecruiters ─────────────────────────────────────────────────────────
// https://developers.smartrecruiters.com/docs/posting-api
async function smartrecruiters(emp) {
  const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(emp.board)}/postings`;
  const all = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const page = await getJson(`${base}?limit=100&offset=${offset}`);
    if (!Array.isArray(page.content)) throw new Error('Unexpected SmartRecruiters response');
    all.push(...page.content);
    if (all.length >= page.totalFound || page.content.length === 0) break;
  }
  if (!all.length) {
    // An unknown company id also returns an empty list — flag it so it isn't mistaken for "all closed".
    throw Object.assign(new Error(`SmartRecruiters returned 0 postings for "${emp.board}" — check the company id`), { permanent: true });
  }
  // Fetch full details only for internship-looking postings (keeps API calls low).
  const candidates = all.filter(p => looksIntern(p.name) || /intern/.test(p.typeOfEmployment?.id || '') || p.experienceLevel?.id === 'internship');
  const details = await pool(candidates, 4, p => getJson(`${base}/${p.id}`));
  const jobs = details.map(d => {
    const sections = d.jobAd?.sections || {};
    const text = ['companyDescription', 'jobDescription', 'qualifications', 'additionalInformation']
      .map(k => sections[k] ? `${sections[k].title || ''}\n${htmlToText(sections[k].text || '')}` : '')
      .join('\n');
    const l = d.location || {};
    const comp = d.compensation;
    const pay = comp ? fmtRange(comp.min, comp.max, comp.currency, comp.period) : null;
    return {
      sourceJobId: String(d.id),
      title: squish(d.name),
      company: emp.name,
      url: d.postingUrl,
      applyUrl: d.applyUrl || d.postingUrl,
      locations: [{ city: l.city, state: l.region, remote: !!l.remote, hybrid: !!l.hybrid, text: l.fullLocation || [l.city, l.region].filter(Boolean).join(', ') }],
      workplaceType: l.remote && !l.hybrid ? 'remote' : l.hybrid ? 'hybrid' : '',
      employmentType: d.typeOfEmployment?.label || '',
      text,
      postedAt: toIso(d.releasedDate),
      pay,
      closed: d.active === false,
    };
  });
  // Non-intern postings are returned in light form so closure tracking still sees the full board.
  const detailed = new Set(jobs.map(j => j.sourceJobId));
  for (const p of all) {
    if (detailed.has(String(p.id))) continue;
    jobs.push({ sourceJobId: String(p.id), title: squish(p.name), company: emp.name, url: '', applyUrl: '', locations: [], workplaceType: '', employmentType: p.typeOfEmployment?.label || '', text: '', postedAt: toIso(p.releasedDate), pay: null, closed: false });
  }
  return jobs;
}

function fmtRange(min, max, currency = 'USD', interval = '') {
  if (!min && !max) return null;
  const sym = !currency || currency === 'USD' ? '$' : `${currency} `;
  const lo = min ? sym + fmtNum(min) : '';
  const hi = max && max !== min ? sym + fmtNum(max) : '';
  const range = lo && hi ? `${lo} – ${hi}` : lo || `Up to ${hi}`;
  return range + intervalLabel(interval);
}

function fmtNum(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(n);
}
function intervalLabel(i = '') {
  const s = String(i).toLowerCase();
  if (/hour/.test(s)) return '/hour';
  if (/week/.test(s)) return '/week';
  if (/month/.test(s)) return '/month';
  if (/year|annual/.test(s)) return '/year';
  return '';
}

export const ADAPTERS = { greenhouse, lever, ashby, smartrecruiters };

export async function fetchEmployer(emp) {
  const fn = ADAPTERS[emp.ats];
  if (!fn) throw Object.assign(new Error(`Unknown ats "${emp.ats}"`), { permanent: true });
  return fn(emp);
}

export { pool };
