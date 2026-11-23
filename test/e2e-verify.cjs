// Browser check of the real site (needs Playwright: `npx playwright install chromium` once).
//   npm run serve   (in another terminal)
//   node test/e2e-verify.cjs [http://localhost:8080] [screenshot-dir]
// Verifies: listings render; section + industry filters combine; location filters
// (using a fixture with NYC / NJ / Philadelphia listings); apply links; Saved/Applied
// marks persist across reloads and across a data refresh (including closed listings).
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.argv[2] || 'http://localhost:8080';
const SHOTS = process.argv[3] || null;

function fixture(live) {
  const mk = (id, title, company, regions, locations, roles, industries, term, postedAt) => ({
    id, key: id, title, company, regions, locations, roles, industries, term, termInferred: false, workplace: '',
    postedAt, firstSeenAt: '2026-11-20T13:00:00.000Z', lastSeenAt: '2026-11-23T13:00:00.000Z', status: 'active', closedAt: null,
    applyUrl: `https://example.com/apply/${id}`, applyLinks: [{ label: locations.join(' / '), url: `https://example.com/apply/${id}` }],
    pay: null, eligibility: [], description: '', sources: [],
  });
  return {
    ...live,
    listings: [
      mk('fx-nyc', 'Brand Strategy Intern', 'Fixture NYC Co', ['nyc'], ['Brooklyn, NY'], ['Marketing', 'Brand Marketing'], ['Beauty'], 'Summer 2027', '2026-11-22T12:00:00.000Z'),
      mk('fx-nj', 'Social Media Intern', 'Fixture NJ Co', ['nj'], ['Hoboken, NJ'], ['Marketing', 'Social Media'], ['Fashion'], 'Summer 2027', '2026-11-21T12:00:00.000Z'),
      mk('fx-phl', 'Sales Intern', 'Fixture Philly Co', ['philadelphia'], ['Philadelphia, PA'], ['Sales'], ['Banking & Financial Services'], 'Fall 2027', null),
    ],
  };
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const ok = msg => { results.push(`✓ ${msg}`); console.log(`✓ ${msg}`); };

  // ── Desktop, live data ────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('.card');
  const live = await (await page.request.get(`${BASE}/data/listings.json`)).json();
  const active = live.listings.filter(l => l.status === 'active');
  assert.equal(await page.locator('.card').count(), active.length);
  ok(`All tab shows all ${active.length} active live listings`);
  assert.match(await page.locator('#refreshLine').innerText(), /Last successful refresh: .*20\d\d/);
  ok(`Header shows "${await page.locator('#refreshLine').innerText()}"`);

  // Newest first
  const dates = active.map(l => l.postedAt || l.firstSeenAt);
  assert.deepEqual(dates, [...dates].sort().reverse());
  ok('Listings are ordered newest first');

  // Each card has title, company, location, tags, date, apply link
  for (const [i, l] of active.entries()) {
    const card = page.locator('.card').nth(i);
    assert.equal(await card.locator('.title').innerText(), l.title);
    assert.equal(await card.locator('.company').innerText(), l.company);
    const href = await card.locator('a.apply').getAttribute('href');
    assert.equal(href, new URL(l.applyUrl).href);
    assert.equal(await card.locator('a.apply').getAttribute('target'), '_blank');
    assert.match(await card.locator('.meta').innerText(), /Posted|First found/);
  }
  ok('Every card shows title, company, location, date and a direct apply link to the source posting');

  // Section + industry combine
  await page.click('.tab[data-section="Sales"]');
  await page.click('.chip[data-industry="Entertainment"]');
  const combo = active.filter(l => l.roles.includes('Sales') && l.industries.includes('Entertainment'));
  assert.equal(await page.locator('.card').count(), combo.length);
  ok(`Sales section + Entertainment filter → ${combo.length} listings (matches data)`);
  await page.click('.chip[data-industry=""]');
  await page.click('.tab[data-section="all"]');

  // Search
  await page.fill('#search', 'sotheby');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.card').count(), active.filter(l => /sotheby/i.test(l.company)).length);
  ok('Search by company name works');
  await page.fill('#search', '');
  await page.waitForTimeout(300);

  // Term filter
  await page.selectOption('#termFilter', 'Summer 2027');
  assert.equal(await page.locator('.card').count(), active.filter(l => l.term === 'Summer 2027').length);
  ok(`Term filter "Summer 2027" → ${active.filter(l => l.term === 'Summer 2027').length} listings`);
  await page.selectOption('#termFilter', '');

  // Apply link opens the real posting (Greenhouse-hosted one)
  const ghIdx = active.findIndex(l => /job-boards\.greenhouse\.io/.test(l.applyUrl));
  if (ghIdx >= 0) {
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('.card').nth(ghIdx).locator('a.apply').click()]);
    await popup.waitForLoadState('domcontentloaded');
    const title = await popup.title();
    assert.match(title, new RegExp(active[ghIdx].title.split(/[^A-Za-z0-9 ]/)[0].trim().slice(0, 15), 'i'));
    ok(`Clicking Apply opened the live posting in a new tab: "${title}"`);
    await popup.close();
  }

  // Save + Applied, persist across reload
  const first = active[0], second = active[1];
  await page.locator(`.card[data-id="${first.id}"] .actions .save`).click();
  await page.locator(`.card[data-id="${second.id}"] .actions .applied`).click();
  await page.reload();
  await page.waitForSelector('.card');
  assert.equal(await page.locator(`.card[data-id="${first.id}"] .actions .save`).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator(`.card[data-id="${second.id}"] .actions .applied`).getAttribute('aria-pressed'), 'true');
  ok('Saved and Applied marks survive a page reload');
  await page.click('.tab[data-section="saved"]');
  assert.equal(await page.locator('.card').count(), 1);
  await page.click('.tab[data-section="applied"]');
  assert.equal(await page.locator('.card').count(), 1);
  assert.match(await page.locator('.card .badges').innerText(), /Applied/i);
  ok('Saved and Applied tabs list the marked internships');
  await page.click('.tab[data-section="all"]');
  await page.check('#hideApplied');
  assert.equal(await page.locator('.card').count(), active.length - 1);
  await page.uncheck('#hideApplied');
  ok('"Hide applied" hides applied internships from the main list');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop.png`, fullPage: false });

  // Simulate the next daily refresh: the saved listing is closed by its source, the applied one is gone.
  const nextDay = JSON.parse(JSON.stringify(live));
  nextDay.lastSuccessfulRefresh = new Date().toISOString();
  nextDay.listings.find(l => l.id === first.id).status = 'closed';
  nextDay.listings.find(l => l.id === first.id).closedAt = new Date().toISOString();
  nextDay.listings = nextDay.listings.filter(l => l.id !== second.id);
  await page.route('**/data/listings.json', r => r.fulfill({ json: nextDay }));
  await page.reload();
  await page.waitForSelector('.card');
  assert.equal(await page.locator(`.card[data-id="${first.id}"]`).count(), 0, 'closed listing hidden from active results');
  await page.click('.tab[data-section="saved"]');
  assert.match(await page.locator(`.card[data-id="${first.id}"] .badges`).innerText(), /Closed/i);
  await page.click('.tab[data-section="applied"]');
  assert.match(await page.locator(`.card[data-id="${second.id}"] .badges`).innerText(), /No longer listed/i);
  assert.equal(await page.locator(`.card[data-id="${second.id}"] .title`).innerText(), second.title);
  ok('After a refresh, closed listings leave active results but stay in Saved/Applied with a Closed / No longer listed badge');
  await page.unroute('**/data/listings.json');

  // ── Location filters (fixture with all three regions) ─────────────────────
  await page.route('**/data/listings.json', r => r.fulfill({ json: fixture(live) }));
  await page.evaluate(() => localStorage.removeItem('internship-finder:filters:v1'));
  await page.reload();
  await page.waitForSelector('.card');
  await page.click('.tab[data-section="all"]');
  const opts = await page.locator('#locationFilter option').allInnerTexts();
  assert.deepEqual(opts, ['All locations', 'New York City', 'Philadelphia, PA', 'New Jersey']);
  for (const [val, company] of [['nyc', 'Fixture NYC Co'], ['nj', 'Fixture NJ Co'], ['philadelphia', 'Fixture Philly Co']]) {
    await page.selectOption('#locationFilter', val);
    const companies = await page.locator('.card .company').allInnerTexts();
    assert.deepEqual(companies, [company]);
  }
  ok('Location filter shows only New York City / New Jersey / Philadelphia listings respectively');
  await page.selectOption('#locationFilter', '');
  assert.match(await page.locator('.card[data-id="fx-phl"] .meta').innerText(), /First found .*posting date not provided/);
  ok('Listings without a posting date show a clearly labeled "First found" date');
  await page.selectOption('#locationFilter', 'nj');
  await page.click('.tab[data-section="Social Media"]');
  assert.equal(await page.locator('.card').count(), 1);
  await page.click('.chip[data-industry="Beauty"]');
  assert.equal(await page.locator('.card').count(), 0);
  assert.equal(await page.locator('#empty').isVisible(), true);
  ok('Location + section + industry filters combine (and show an empty-state message)');
  assert.deepEqual(errors, []);
  ok('No JavaScript errors');
  await ctx.close();

  // ── Phone ─────────────────────────────────────────────────────────────────
  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const p2 = await phone.newPage();
  await p2.goto(BASE);
  await p2.waitForSelector('.card');
  const overflow = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
  const box = await p2.locator('.card a.apply').first().boundingBox();
  assert.ok(box.height >= 40, 'apply button is a comfortable tap target');
  ok('Phone layout (iPhone 13): no horizontal scrolling, full-width Apply buttons');
  if (SHOTS) await p2.screenshot({ path: `${SHOTS}/phone.png` });
  await phone.close();

  await browser.close();
  console.log(`\nAll ${results.length} checks passed.`);
})().catch(err => { console.error('✗', err.message); process.exit(1); });
