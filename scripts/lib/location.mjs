import { ALLOWED_REGIONS, STATE_NAMES } from '../../config/locations.mjs';

const STATE_CODES = new Set(Object.values(STATE_NAMES));
const COUNTRY_WORDS = /\b(united states( of america)?|usa|u\.s\.a\.|u\.s\.|us)\b\.?/g;
const VAGUE = /\b(metro(politan)?( area)?|greater|area|region|tri-?state|northeast|east coast|nationwide|anywhere|multiple|various|flexible|hq|headquarters)\b/;

/**
 * Normalize one raw location into { city, state, remote, hybrid, text }.
 * `raw` may be a string or a structured { city, state, remote, hybrid } object.
 */
export function parseLocation(raw) {
  if (raw && typeof raw === 'object') {
    const stateRaw = String(raw.state || '').trim().toLowerCase();
    const state = STATE_NAMES[stateRaw] || (stateRaw.length === 2 ? stateRaw.toUpperCase() : '');
    return {
      city: String(raw.city || '').trim().toLowerCase(),
      state,
      remote: !!raw.remote,
      hybrid: !!raw.hybrid,
      text: raw.text || [raw.city, raw.state].filter(Boolean).join(', '),
    };
  }
  const text = String(raw || '').trim();
  let s = text.toLowerCase().replace(/[()[\]]/g, ' , ');
  const remote = /\b(remote|virtual|work from home|wfh|telecommute|distributed)\b/.test(s);
  const hybrid = /\bhybrid\b/.test(s);
  s = s.replace(/\b(remote|virtual|hybrid|on-?site|in-?office|office|work from home|wfh|telecommute)\b/g, ' , ');

  // "US-NY-New York" / "USA - NY - New York" style
  const iCims = s.match(/^\s*(?:us|usa)\s*-\s*([a-z]{2})\s*-\s*(.+)$/);
  if (iCims) return { city: iCims[2].replace(/[^a-z .'-]/g, '').trim(), state: iCims[1].toUpperCase(), remote, hybrid, text };

  s = s.replace(COUNTRY_WORDS, ' ');
  const parts = s.split(/[,\-–—:]/).map(p => p.replace(/[^a-z .'&]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  let city = '';
  let state = '';
  for (const p of parts) {
    const asCode = p.length === 2 ? p.toUpperCase() : '';
    if (!state && STATE_CODES.has(asCode)) { state = asCode; continue; }
    if (!state && STATE_NAMES[p]) {
      // A leading "New York" is the city (very common in postings); "X, New York" is the state.
      if (p === 'new york' && !city) { city = p; continue; }
      state = STATE_NAMES[p];
      continue;
    }
    if (!city) city = p;
  }
  return { city, state, remote, hybrid, text };
}

function cityMatches(city, list) {
  if (!city || !list) return false;
  return list.includes(city);
}

/** Which allowed region (if any) does one parsed location fall in? */
export function regionFor(loc) {
  if (!loc || (!loc.city && !loc.state)) return null;
  if (loc.city && VAGUE.test(loc.city)) return null;
  for (const r of ALLOWED_REGIONS) {
    if (loc.state && loc.state !== r.state) continue;
    if (loc.state === r.state) {
      if (r.wholeState) return r;
      if (cityMatches(loc.city, r.cities)) return r;
      continue;
    }
    // No state given: only accept cities that are unambiguous without one.
    if (cityMatches(loc.city, r.citiesNoStateNeeded)) return r;
  }
  return null;
}

function titleCase(s) {
  return s.replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bNyc\b/, 'NYC');
}

export function displayLabel(loc, region) {
  if (region.id === 'nyc') {
    const borough = ['brooklyn', 'queens', 'bronx', 'the bronx', 'staten island', 'long island city'].includes(loc.city) ? titleCase(loc.city) : 'New York';
    return `${borough}, NY`;
  }
  if (region.id === 'philadelphia') return 'Philadelphia, PA';
  return loc.city ? `${titleCase(loc.city)}, ${region.state}` : region.label;
}

/** Split a free-text location field that may hold several locations. */
export function splitLocationText(text) {
  return String(text || '')
    .split(/\s*(?:;|\||\/|\n|\bor\b|\band\b|·|•)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Decide whether a job is in an allowed location.
 * @param {Array<string|object>} rawLocations every location the source gives
 * @param {string} workplaceType 'remote' | 'hybrid' | 'onsite' | '' (from the source, if it says)
 * @returns {{ ok, regions, labels, workplace, reason }}
 */
export function evaluateLocations(rawLocations, workplaceType = '') {
  const wt = String(workplaceType || '').toLowerCase().replace(/[^a-z]/g, '');
  const parsed = [];
  for (const raw of rawLocations) {
    if (typeof raw === 'string') for (const piece of splitLocationText(raw)) parsed.push(parseLocation(piece));
    else if (raw) parsed.push(parseLocation(raw));
  }
  const matches = [];
  for (const loc of parsed) {
    const region = regionFor(loc);
    if (!region) continue;
    // A location explicitly marked remote ("Remote - New York") is not an office.
    if (loc.remote && !loc.hybrid) continue;
    matches.push({ loc, region });
  }
  let workplace = wt === 'remote' ? 'remote' : wt === 'hybrid' ? 'hybrid' : wt === 'onsite' || wt === 'inoffice' ? 'on-site' : '';
  if (!workplace) {
    if (parsed.some(l => l.hybrid)) workplace = 'hybrid';
    else if (parsed.length && parsed.every(l => l.remote)) workplace = 'remote';
  }
  if (workplace === 'remote') return { ok: false, regions: [], labels: [], workplace, reason: 'fully remote' };
  if (!matches.length) {
    return { ok: false, regions: [], labels: [], workplace, reason: parsed.length ? 'outside allowed locations or unverifiable' : 'no location given' };
  }
  const regions = [...new Set(matches.map(m => m.region.id))];
  const labels = [...new Set(matches.map(m => displayLabel(m.loc, m.region)))];
  return { ok: true, regions, labels, workplace: workplace || '', reason: '' };
}
