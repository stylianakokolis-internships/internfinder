#!/usr/bin/env node
// Daily refresh: fetch every employer board, keep qualifying internships,
// merge with stored results, and write site/data/listings.json.
//
//   npm run refresh                 # all employers
//   npm run refresh -- --only=stripe,glossier   # just some (by board id)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPLOYERS, INDUSTRY_FILTERS } from '../config/employers.mjs';
import { ALLOWED_REGIONS } from '../config/locations.mjs';
import { fetchEmployer, pool } from './lib/sources/index.mjs';
import { internshipCheck, classifyRoles, detectTerm, extractPay, extractEligibility, ROLE_SECTIONS } from './lib/classify.mjs';
import { evaluateLocations } from './lib/location.mjs';
import { hashId, normTitle, slug } from './lib/text.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = resolve(ROOT, 'site/data/listings.json');
const REPORT_FILE = resolve(ROOT, 'data/last-run-report.json');
const KEEP_CLOSED_DAYS = 90;
const DESCRIPTION_CHARS = 2500;

const sourceKey = emp => `${emp.ats}:${emp.board}`;

/** Turn one raw job into a candidate listing, or return the reason it was skipped. */
export function qualify(job, emp) {
  const check = internshipCheck(job);
  if (!check.ok) return { skip: check.reason };
  const loc = evaluateLocations(job.locations, job.workplaceType);
  if (!loc.ok) return { skip: loc.reason };
  const roles = classifyRoles({ ...job, company: emp.name });
  if (!roles.length) return { skip: 'not a marketing / social / brand / sales role' };
  const { term, inferred } = detectTerm(job);
  return {
    candidate: {
      company: emp.name,
      title: job.title,
      industries: emp.industries,
      roles,
      term,
      termInferred: inferred,
      locations: loc.labels,
      regions: loc.regions,
      workplace: loc.workplace,
      postedAt: job.postedAt,
      applyUrl: job.applyUrl || job.url,
      postingUrl: job.url,
      // SmartRecruiters' structured pay period is often wrong ("$19/week"); prefer the posting text there.
      pay: emp.ats === 'smartrecruiters' ? extractPay(job.text) || job.pay : job.pay || extractPay(job.text),
      eligibility: extractEligibility(job.text),
      employmentType: job.employmentType || '',
      description: job.text.slice(0, DESCRIPTION_CHARS),
      source: { key: sourceKey(emp), jobId: job.sourceJobId },
    },
  };
}

function mergeKey(c) {
  return `${slug(c.company)}|${normTitle(c.title)}|${c.term}`;
}

/** Merge candidates that are the same internship posted for several offices / reqs. */
export function mergeCandidates(cands) {
  const byKey = new Map();
  for (const c of cands) {
    const key = mergeKey(c);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...c, key, applyLinks: [{ label: c.locations.join(' / '), url: c.applyUrl }], sources: [c.source] });
      continue;
    }
    prev.locations = [...new Set([...prev.locations, ...c.locations])];
    prev.regions = [...new Set([...prev.regions, ...c.regions])];
    prev.roles = ROLE_SECTIONS.filter(r => prev.roles.includes(r) || c.roles.includes(r));
    if (c.postedAt && (!prev.postedAt || c.postedAt < prev.postedAt)) prev.postedAt = c.postedAt;
    prev.pay = prev.pay || c.pay;
    if (!prev.eligibility.length) prev.eligibility = c.eligibility;
    if (!prev.applyLinks.some(l => l.url === c.applyUrl)) prev.applyLinks.push({ label: c.locations.join(' / '), url: c.applyUrl });
    prev.sources.push(c.source);
  }
  return [...byKey.values()];
}

async function loadStore(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return { listings: [], sources: {} };
  }
}

function parseArgs() {
  const only = process.argv.find(a => a.startsWith('--only='));
  return { only: only ? only.slice(7).split(',').map(s => s.trim().toLowerCase()) : null };
}

export async function main({ only = parseArgs().only, employerList = EMPLOYERS, dataFile = DATA_FILE, reportFile = REPORT_FILE, now = () => new Date(), quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  const warn = quiet ? () => {} : console.warn;
  const startedAt = now().toISOString();
  const employers = only ? employerList.filter(e => only.includes(e.board.toLowerCase())) : employerList;
  const store = await loadStore(dataFile);
  const listings = new Map((store.listings || []).map(l => [l.id, l]));
  const sources = { ...(store.sources || {}) };
  const report = { startedAt, employers: [] };

  const results = await pool(employers, 6, async emp => {
    const key = sourceKey(emp);
    try {
      const raw = await fetchEmployer(emp);
      return { emp, key, raw };
    } catch (err) {
      return { emp, key, error: err };
    }
  });

  let okCount = 0;
  for (const { emp, key, raw, error } of results) {
    const prevSource = sources[key] || {};
    if (error) {
      sources[key] = { ...prevSource, employer: emp.name, ok: false, lastAttempt: startedAt, error: String(error.message || error).slice(0, 300) };
      report.employers.push({ employer: emp.name, key, ok: false, error: sources[key].error });
      warn(`✗ ${emp.name} (${key}): ${sources[key].error} — keeping last good results`);
      continue;
    }

    // Safety: a board that suddenly returns nothing after having many jobs is more likely an
    // outage than every job closing at once. Keep the old results in that case.
    if (raw.length === 0 && (prevSource.rawCount || 0) >= 5) {
      sources[key] = { ...prevSource, employer: emp.name, ok: false, lastAttempt: startedAt, error: 'Board returned 0 jobs (had jobs before) — treated as a temporary outage' };
      report.employers.push({ employer: emp.name, key, ok: false, error: sources[key].error });
      warn(`! ${emp.name}: 0 jobs returned; keeping last good results`);
      continue;
    }

    okCount++;
    const skipped = {};
    const cands = [];
    for (const job of raw) {
      if (job.closed) continue;
      const q = qualify(job, emp);
      if (q.candidate) cands.push(q.candidate);
      else if (/\b(intern|interns|internships?)\b/i.test(job.title)) (skipped[q.skip] ||= []).push(`${job.title} — ${JSON.stringify(job.locations).slice(0, 80)}`);
    }
    const merged = mergeCandidates(cands);
    const openRawIds = new Set(raw.filter(j => !j.closed).map(j => j.sourceJobId));
    const seenIds = new Set();

    for (const m of merged) {
      const id = hashId(m.key);
      seenIds.add(id);
      const prev = listings.get(id);
      listings.set(id, {
        id,
        ...m,
        firstSeenAt: prev?.firstSeenAt || startedAt,
        lastSeenAt: startedAt,
        status: 'active',
        closedAt: null,
      });
    }

    // Anything we had for this employer that the source no longer lists → closed.
    for (const l of listings.values()) {
      if (l.company !== emp.name || seenIds.has(l.id) || l.sources?.every(s => s.key !== key)) continue;
      const stillOpenAtSource = l.sources.some(s => s.key === key && openRawIds.has(s.jobId));
      if (stillOpenAtSource) {
        // Still posted, but no longer passes our filters (rules or posting changed) → drop it.
        listings.delete(l.id);
      } else if (l.status === 'active') {
        l.status = 'closed';
        l.closedAt = startedAt;
      }
    }

    sources[key] = { employer: emp.name, ok: true, lastAttempt: startedAt, lastSuccess: startedAt, rawCount: raw.length, matched: merged.length, error: null };
    report.employers.push({ employer: emp.name, key, ok: true, jobsOnBoard: raw.length, matched: merged.map(m => m.title), skippedInternships: skipped });
    log(`✓ ${emp.name.padEnd(28)} ${String(raw.length).padStart(4)} jobs  → ${merged.length} match${merged.length === 1 ? '' : 'es'}`);
  }

  // Drop sources for employers removed from config.
  const configured = new Set(employerList.map(sourceKey));
  for (const k of Object.keys(sources)) if (!configured.has(k)) delete sources[k];
  for (const l of listings.values()) {
    if (l.sources?.every(s => !configured.has(s.key))) listings.delete(l.id);
  }

  // Prune long-closed listings.
  const cutoff = Date.now() - KEEP_CLOSED_DAYS * 864e5;
  for (const l of listings.values()) if (l.status === 'closed' && new Date(l.closedAt).getTime() < cutoff) listings.delete(l.id);

  if (okCount === 0) {
    console.error('No source could be refreshed — leaving stored results untouched.');
    process.exitCode = 1;
    return null;
  }

  const finishedAt = now().toISOString();
  const sorted = [...listings.values()].sort((a, b) => (b.postedAt || b.firstSeenAt).localeCompare(a.postedAt || a.firstSeenAt) || a.id.localeCompare(b.id));
  const out = {
    schemaVersion: 1,
    lastSuccessfulRefresh: finishedAt,
    lastRunStartedAt: startedAt,
    sourcesOk: Object.values(sources).filter(s => s.ok).length,
    sourcesTotal: Object.keys(sources).length,
    config: {
      roleSections: ROLE_SECTIONS,
      industryFilters: INDUSTRY_FILTERS,
      regions: ALLOWED_REGIONS.map(r => ({ id: r.id, label: r.label })),
    },
    sources,
    listings: sorted,
  };
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(out, null, 1) + '\n');
  report.finishedAt = finishedAt;
  if (reportFile) {
    await mkdir(dirname(reportFile), { recursive: true });
    await writeFile(reportFile, JSON.stringify(report, null, 1) + '\n');
  }

  const active = sorted.filter(l => l.status === 'active');
  log(`\nDone. ${okCount}/${employers.length} sources refreshed. ${active.length} active internships (${sorted.length - active.length} closed kept for history).`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
