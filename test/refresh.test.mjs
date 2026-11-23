// End-to-end refresh logic against fake job-board responses: merging duplicates,
// keeping first-seen dates, closing listings the source removed, and keeping the
// last good data when a source is down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../scripts/refresh.mjs';

const EMPLOYERS = [
  { name: 'Acme Beauty', ats: 'greenhouse', board: 'acmebeauty', industries: ['Beauty'] },
  { name: 'Studio Agency', ats: 'lever', board: 'studio', industries: ['Agencies'] },
];

const gh = (id, title, location, extra = {}) => ({ id, title, location: { name: location }, absolute_url: `https://job-boards.greenhouse.io/acmebeauty/jobs/${id}`, content: '&lt;p&gt;Support marketing campaigns. Pay: $22/hour.&lt;/p&gt;', first_published: '2026-11-10T12:00:00-05:00', metadata: [], ...extra });

let feeds;
function installFetch() {
  globalThis.fetch = async url => {
    const u = String(url);
    const body = u.includes('greenhouse') ? feeds.greenhouse : feeds.lever;
    if (body instanceof Error) return new Response('down', { status: 503 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

test('refresh: merge, persist, close, and survive outages', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'if-'));
  const dataFile = join(dir, 'listings.json');
  installFetch();
  const run = (iso) => main({ employerList: EMPLOYERS, dataFile, reportFile: null, now: () => new Date(iso), quiet: true, only: null });

  // Day 1
  feeds = {
    greenhouse: { jobs: [
      gh(1, 'Brand Marketing Intern - Summer 2027', 'New York, NY'),
      gh(2, 'Brand Marketing Intern - Summer 2027', 'Jersey City, NJ'),   // same internship, second office → merged
      gh(3, 'Software Engineering Intern', 'New York, NY'),               // not a marketing role
      gh(4, 'Marketing Intern', 'Remote - US'),                           // fully remote
      gh(5, 'Senior Brand Manager', 'New York, NY'),                      // not an internship
    ] },
    lever: [{ id: 'a', text: 'Social Media Intern', categories: { location: 'Philadelphia, PA', commitment: 'Intern' }, workplaceType: 'hybrid', hostedUrl: 'https://jobs.lever.co/studio/a', applyUrl: 'https://jobs.lever.co/studio/a/apply', descriptionPlain: 'Create TikTok and Instagram content.', createdAt: Date.parse('2026-11-12T00:00:00Z') }],
  };
  let out = await run('2026-11-23T13:05:00Z');
  assert.equal(out.listings.length, 2);
  const brand = out.listings.find(l => l.company === 'Acme Beauty');
  assert.deepEqual(brand.locations, ['New York, NY', 'Jersey City, NJ']);
  assert.equal(brand.applyLinks.length, 2);
  assert.deepEqual(brand.roles, ['Marketing', 'Brand Marketing']);
  assert.equal(brand.term, 'Summer 2027');
  assert.equal(brand.pay, '$22/hour');
  const social = out.listings.find(l => l.company === 'Studio Agency');
  assert.equal(social.workplace, 'hybrid');
  assert.deepEqual(social.roles, ['Marketing', 'Social Media']);
  assert.equal(out.listings[0].id, social.id, 'newest posted first');
  const brandId = brand.id;

  // Day 2: Lever is down → Studio listing kept as-is; brand listing unchanged id + firstSeen
  feeds.lever = new Error('down');
  out = await run('2026-11-24T13:05:00Z');
  assert.equal(out.listings.find(l => l.id === social.id).status, 'active');
  assert.equal(out.sources['lever:studio'].ok, false);
  assert.equal(out.sources['lever:studio'].lastSuccess, '2026-11-23T13:05:00.000Z');
  assert.equal(out.listings.find(l => l.id === brandId).firstSeenAt, '2026-11-23T13:05:00.000Z');
  assert.equal(out.lastSuccessfulRefresh, '2026-11-24T13:05:00.000Z');

  // Day 3: Greenhouse removes the brand internship → closed (hidden from active), not deleted
  feeds.greenhouse = { jobs: [gh(3, 'Software Engineering Intern', 'New York, NY')] };
  feeds.lever = [];
  out = await run('2026-11-25T13:05:00Z');
  const closed = out.listings.find(l => l.id === brandId);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closedAt, '2026-11-25T13:05:00.000Z');
  assert.equal(out.listings.find(l => l.id === social.id).status, 'closed');

  // Day 4: every source down → file untouched
  feeds = { greenhouse: new Error('x'), lever: new Error('x') };
  const before = await readFile(dataFile, 'utf8');
  const res = await run('2026-11-26T13:05:00Z');
  assert.equal(res, null);
  assert.equal(await readFile(dataFile, 'utf8'), before);
  process.exitCode = 0;
});
