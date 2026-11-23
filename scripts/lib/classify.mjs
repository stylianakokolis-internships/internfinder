// Rules that decide (1) is this an undergrad internship, (2) which role sections
// it belongs to, (3) its term, and (4) pay / eligibility notes.
// Role keywords live in ROLE_RULES below — edit them to tune the sections.

export const ROLE_SECTIONS = ['Marketing', 'Social Media', 'Brand Marketing', 'Sales'];

// ── 1. Is it an internship we want? ─────────────────────────────────────────
const INTERN_TITLE = /\b(intern|interns|internship|internships|co-?op|summer analyst|summer intern|summer program|summer internship)\b/i;
const SENIOR_TITLE = /\b(senior|sr\.?|lead|leader|manager|director|principal|head of|vp|vice president|staff|chief|supervisor|coordinator of|program manager|recruiter)\b/i;
const GRAD_TITLE = /\b(mba|ph\.?d|doctoral|post-?doc|master'?s|graduate (intern|student|program)|law (clerk|intern|student)|j\.?d\.?|legal intern|summer associate)\b/i;
const GRAD_TEXT = /\b(mba (student|candidate|program)|currently (enrolled|pursuing)[^.]{0,40}\b(mba|master'?s|ph\.?d|graduate (degree|program)|doctoral|law school)|pursuing (an? )?(mba|master'?s|ph\.?d|doctoral|graduate) (degree|program)|graduate students? only|enrolled in (a|an) (graduate|master'?s|ph\.?d|mba|law) program|(first|second)[- ]year (mba|law|j\.?d\.?) students?)\b/i;
const UNDERGRAD_TEXT = /\b(undergrad|undergraduate|bachelor'?s|rising (sophomore|junior|senior)s?|college (junior|senior|student)s?|sophomore|junior year|senior year|class of 20\d\d|associate'?s degree|ba\/bs|b\.?a\.?|b\.?s\.?)\b/i;

/**
 * @returns {{ ok: boolean, reason: string }}
 */
export function internshipCheck({ title, employmentType = '', text = '' }) {
  const t = title || '';
  const et = String(employmentType).toLowerCase();
  const titleSaysIntern = INTERN_TITLE.test(t);
  const typeSaysIntern = /intern|co-?op|student|temporary student/.test(et);
  if (!titleSaysIntern && !typeSaysIntern) return { ok: false, reason: 'not an internship' };
  if (SENIOR_TITLE.test(t)) return { ok: false, reason: 'senior / staff role' };
  if (GRAD_TITLE.test(t)) {
    // "Bachelor's or Master's" titles are open to undergrads.
    if (!/bachelor|undergrad/i.test(t)) return { ok: false, reason: 'graduate students only' };
  }
  if (GRAD_TEXT.test(text) && !UNDERGRAD_TEXT.test(text)) return { ok: false, reason: 'graduate students only' };
  if (/full[- ]time/.test(et) && !titleSaysIntern) return { ok: false, reason: 'full-time role' };
  return { ok: true, reason: '' };
}

// ── 2. Role sections ────────────────────────────────────────────────────────
// title:  a match in the job title puts the job in the section.
// text:   phrases counted in the description; `minText` distinct phrases (or
//         `minCount` total mentions of the first phrase) also qualify — but only for
//         generic titles like "Summer Intern" (see OTHER_FIELD_TITLE).
// alsoAdd: sections implied by a title match (Brand Strategy → Marketing too).
const ROLE_RULES = {
  Marketing: {
    title: /\b(marketing|growth|go-to-market|gtm|communications?|comms|public relations|pr|publicity|content|campaigns?|advertising|consumer insights?|audience|crm|e-?commerce|influencer|creative strategy|media (planning|strategy|buying)|events? marketing|community)\b/i,
    text: [/\bmarketing\b/gi, /\bmarketing campaigns?\b/gi, /\bgo-to-market\b/gi, /\bmarket research\b/gi, /\bconsumer insights?\b/gi, /\bcampaign (strategy|planning|execution|performance)\b/gi, /\bpublic relations\b/gi, /\bcontent (strategy|calendar|creation)\b/gi],
    minText: 3,
    minCount: 5,
  },
  'Social Media': {
    title: /\b(social|social media|tiktok|instagram|influencer|creator|community)\b/i,
    text: [/\bsocial media\b/gi, /\b(tiktok|instagram|youtube shorts|reels)\b/gi, /\binfluencers?\b/gi, /\bsocial (content|strategy|channels|platforms|listening)\b/gi, /\bcommunity management\b/gi],
    minText: 3,
    minCount: 4,
    alsoAdd: ['Marketing'],
  },
  'Brand Marketing': {
    title: /\b(brand|brands|branding)\b/i,
    text: [/\bbrand marketing\b/gi, /\bbrand strategy\b/gi, /\bbrand management\b/gi, /\bbrand awareness\b/gi, /\bbrand (campaigns?|identity|partnerships?|positioning|voice|activations?)\b/gi],
    minText: 2,
    minCount: 3,
    alsoAdd: ['Marketing'],
  },
  Sales: {
    title: /\b(sales|business development|bdr|sdr|account (executive|management|manager|development)|partnerships?|revenue|client (services|solutions|success)|ad sales|sales & trading|sales and trading|private sales)\b/i,
    text: [/\bsales\b/gi, /\bprospect(ing|s)?\b/gi, /\blead generation\b/gi, /\bquota\b/gi, /\bclient relationships?\b/gi, /\bbusiness development\b/gi, /\bpipeline\b/gi],
    minText: 3,
    minCount: 5,
  },
};

// Titles clearly in another field: only title keywords (never the description)
// can put these in a section. "Marketing Data Analyst Intern" still counts via
// its title; "Software Engineering Intern" never does.
const OTHER_FIELD_TITLE = /\b(engineer(ing)?|software|developer|data|machine learning|ml|ai|research(er)?|scientist|science|quant(itative)?|trad(er|ing)|accounting|accountant|audit|tax|legal|law|finance|financial|treasury|fp&a|investment|investing|actuar(y|ial)|hr|human resources|people|talent|recruiting|it|cyber|security|design(er)?|ux|ui|product|operations|ops|editorial|news|journalis[mt]|reporter|producer|production|photo(graphy)?|video|visuals|meteorolog(y|ist)|weather|supply chain|logistics|manufacturing|compliance|risk|policy|analytics|economics?|infrastructure|platform|strategy & operations)\b/i;

function countDistinct(text, patterns) {
  let distinct = 0;
  let firstCount = 0;
  patterns.forEach((re, i) => {
    const n = (text.match(re) || []).length;
    if (n) distinct++;
    if (i === 0) firstCount = n;
  });
  return { distinct, firstCount };
}

// Titles that are squarely another profession — excluded even if a department
// prefix mentions advertising or partnerships ("Advertising & Partnerships: Data Science Internship").
const NEVER_TITLE = /\b(data scien\w*|software|engineer(ing)?|developer|machine learning|legal|law|accounting|tax|audit|quant\w*|cyber\w*|meteorolog\w*)\b/i;

// "2027 Summer Intern Program (New York)" — a multi-track program; read the description.
export function isGenericTitle(title, company = '') {
  let t = ` ${title.toLowerCase()} `;
  if (company) t = t.split(company.toLowerCase()).join(' ');
  t = t.replace(/\(.*?\)/g, ' ')
    .replace(/\b(20\d\d|summer|fall|autumn|spring|winter|intern(ship)?s?|programs?|programme|analysts?|undergraduate|students?|early careers?|corporate|business|general|new york|nyc|ny|nj|philadelphia|the|and|of|for|-|–)\b/g, ' ')
    .replace(/[^a-z]+/g, '');
  return t.length < 3;
}

export function classifyRoles({ title, text = '', company = '' }) {
  const roles = new Set();
  if (NEVER_TITLE.test(title)) return [];
  const generic = isGenericTitle(title, company);
  for (const [section, rule] of Object.entries(ROLE_RULES)) {
    if (rule.title.test(title)) {
      roles.add(section);
      for (const extra of rule.alsoAdd || []) roles.add(extra);
    }
  }
  // Description-based classification for generic titles ("2027 Summer Intern Program").
  if (!OTHER_FIELD_TITLE.test(title)) {
    for (const [section, rule] of Object.entries(ROLE_RULES)) {
      const { distinct, firstCount } = countDistinct(text, rule.text);
      const minText = generic ? Math.max(1, rule.minText - 1) : rule.minText;
      const minCount = generic ? 2 : rule.minCount;
      if (distinct >= minText || firstCount >= minCount) roles.add(section);
    }
  } else if (roles.size) {
    // A title like "Marketing Analytics Intern" is in Marketing via its title; also let the
    // description add closely related sections (e.g. heavy social-media work).
    for (const [section, rule] of Object.entries(ROLE_RULES)) {
      const { distinct } = countDistinct(text, rule.text);
      if (distinct >= rule.minText + 1) roles.add(section);
    }
  }
  return ROLE_SECTIONS.filter(s => roles.has(s));
}

// ── 3. Internship term ──────────────────────────────────────────────────────
const SEASONS = { summer: 'Summer', fall: 'Fall', autumn: 'Fall', spring: 'Spring', winter: 'Winter' };
const SEASON_START_MONTH = { Spring: 1, Summer: 6, Fall: 9, Winter: 12 };
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function seasonYear(s) {
  const a = s.match(/\b(summer|fall|autumn|spring|winter)\s*(?:of\s*)?(?:'|’)?(20\d\d|\d\d)\b/i);
  if (a) return { season: SEASONS[a[1].toLowerCase()], year: Number(a[2].length === 2 ? `20${a[2]}` : a[2]) };
  const b = s.match(/\b(20\d\d)\s*[-–:]?\s*(summer|fall|autumn|spring|winter)\b/i);
  if (b) return { season: SEASONS[b[2].toLowerCase()], year: Number(b[1]) };
  return null;
}

function mostCommonSeasonYear(text) {
  const re = /\b(summer|fall|autumn|spring|winter)\s*(?:of\s*)?(?:'|’)?(20\d\d)\b|\b(20\d\d)\s+(summer|fall|autumn|spring|winter)\b/gi;
  const counts = new Map();
  let m;
  while ((m = re.exec(text))) {
    const season = SEASONS[(m[1] || m[4]).toLowerCase()];
    const year = Number(m[2] || m[3]);
    const key = `${season} ${year}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (!counts.size) return null;
  const [key] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const [season, year] = key.split(' ');
  return { season, year: Number(year) };
}

function startDateTerm(text) {
  // "June 7 to August 13, 2027", "starting June 1, 2027", "runs from May 26, 2027"
  const re = /\b(start(?:s|ing)?(?: date)?|begin(?:s|ning)?|runs?(?: from)?|program dates?|from|dates?:?)\s*(?:on|is|:)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s*(\d{1,2})?(?:st|nd|rd|th)?,?\s*(?:[-–]|to|through|until)?[^.\n]{0,40}?\b(20\d\d)\b/i;
  const m = text.match(re);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase().replace('.', '')];
  const year = Number(m[4]);
  return monthTerm(month, year);
}

function monthTerm(month, year) {
  const season = month >= 5 && month <= 8 ? 'Summer' : month >= 9 && month <= 11 ? 'Fall' : month === 12 ? 'Winter' : 'Spring';
  return { season, year: month === 12 ? year + 1 : year };
}

function titleMonthYear(title) {
  const m = title.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+(20\d\d)\b/i);
  return m ? monthTerm(MONTHS[m[1].toLowerCase()], Number(m[2])) : null;
}

// "Planning to graduate in 2028" → the summer internship is Summer 2027.
function summerFromGradYear(text, postedIso) {
  const m = text.match(/\bgraduat(?:e|ing|ion)\b[^.\n]{0,60}?\b(20\d\d)\b/i) || text.match(/\bclass of (20\d\d)\b/i);
  if (!m) return null;
  const y = Number(m[1]) - 1;
  const posted = postedIso ? new Date(postedIso).getUTCFullYear() : new Date().getUTCFullYear();
  return y >= posted && y <= posted + 2 ? y : null;
}

function inferYear(season, postedIso) {
  const d = postedIso ? new Date(postedIso) : new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (season === 'Winter') return m <= 1 ? y : y + 1;
  return m < SEASON_START_MONTH[season] ? y : y + 1;
}

/** @returns {{ term: string, inferred: boolean }} e.g. { term: 'Summer 2027', inferred: false } */
export function detectTerm({ title, text = '', postedAt }) {
  const fromTitle = seasonYear(title) || titleMonthYear(title);
  if (fromTitle) return { term: `${fromTitle.season} ${fromTitle.year}`, inferred: false };

  const titleSeason = (title.match(/\b(summer|fall|autumn|spring|winter)\b/i) || [])[1];
  const titleYear = (title.match(/\b(20\d\d)\b/) || [])[1];
  const fromText = mostCommonSeasonYear(text);
  const fromDates = startDateTerm(text);

  if (titleSeason) {
    const season = SEASONS[titleSeason.toLowerCase()];
    const sameSeasonInText = fromText && fromText.season === season ? fromText : fromDates && fromDates.season === season ? fromDates : null;
    if (sameSeasonInText) return { term: `${season} ${sameSeasonInText.year}`, inferred: false };
    const gradSummer = season === 'Summer' && summerFromGradYear(text, postedAt);
    return { term: `${season} ${gradSummer || inferYear(season, postedAt)}`, inferred: true };
  }
  if (titleYear) {
    const y = Number(titleYear);
    const match = (fromText && fromText.year === y && fromText) || (fromDates && fromDates.year === y && fromDates);
    if (match) return { term: `${match.season} ${y}`, inferred: false };
    if (/\bsummer\b/i.test(text)) return { term: `Summer ${y}`, inferred: true };
    return { term: `${y} (season not stated)`, inferred: false };
  }
  if (fromText) return { term: `${fromText.season} ${fromText.year}`, inferred: false };
  if (fromDates) return { term: `${fromDates.season} ${fromDates.year}`, inferred: false };
  if (/\bsummer\b/i.test(text) && /\b(10|11|12)[- ]week\b|\bsummer (internship|program|intern)\b|\bmay-august\b|\bjune-august\b/i.test(text)) {
    return { term: `Summer ${summerFromGradYear(text, postedAt) || inferYear('Summer', postedAt)}`, inferred: true };
  }
  if (/\b(co-?op|year[- ]round|6[- ]month|six[- ]month|part[- ]time)\b/i.test(`${title} ${text}`)) return { term: 'Year-round / co-op', inferred: false };
  return { term: 'Term not stated', inferred: false };
}

// ── 4. Pay and eligibility ──────────────────────────────────────────────────
const MONEY = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s?[kK])?(?:\s*(?:-|–|—|to)\s*\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s?[kK])?)?(?:\s*(?:USD|usd))?(?:\s*(?:\/|per|an|a)\s*(?:hour|hr|week|wk|month|year|yr|annum))?/g;
const PAY_CONTEXT = /\b(pay|paid|salary|compensation|hourly|rate|wage|stipend|range|per hour|\/hr|\/hour|base)\b/i;

export function extractPay(text = '') {
  const lines = text.split(/\n|(?<=\.)\s+/);
  for (const line of lines) {
    if (!PAY_CONTEXT.test(line)) continue;
    const m = line.match(MONEY);
    if (m) {
      const best = m.find(x => /-|–|—|to|hour|hr|year|week|month/i.test(x)) || m[0];
      let pay = best.replace(/\s+/g, ' ').trim();
      if (!/hour|hr|week|wk|month|year|yr|annum/i.test(pay)) {
        if (/\b(per hour|hourly|\/\s?hr|\/\s?hour|an hour)\b/i.test(line)) pay += '/hour';
        else if (/\b(annual|per year|salary|annually)\b/i.test(line)) pay += '/year';
        else if (/\bweekly|per week\b/i.test(line)) pay += '/week';
      }
      return pay;
    }
  }
  return null;
}

const ELIGIBILITY = [
  /\b(graduat(e|ing|ion))\b[^.\n]{0,80}\b(20\d\d)\b/i,
  /\bclass of 20\d\d\b/i,
  /\brising (sophomore|junior|senior)s?\b/i,
  /\b(currently enrolled|must be enrolled|actively enrolled|pursuing an? (undergraduate|bachelor'?s)|undergraduate (student|degree))\b/i,
  /\b(minimum|min\.?)?\s*(gpa|grade point average)\b[^.\n]{0,40}/i,
  /\b(work authorization|authorized to work|visa sponsorship|sponsorship)\b/i,
  /\b(school|academic) credit\b/i,
];

export function extractEligibility(text = '') {
  const sentences = text.split(/\n+|(?<=[.!?])\s+/).map(s => s.replace(/^[•\-*\s]+/, '').trim()).filter(s => s.length > 12 && s.length < 320);
  const out = [];
  for (const re of ELIGIBILITY) {
    const hit = sentences.find(s => re.test(s) && !out.includes(s));
    if (hit) out.push(hit);
    if (out.length >= 4) break;
  }
  return out;
}
