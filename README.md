# Internship Finder

A personal website that lists **marketing, social media, brand marketing and sales internships** in
**New Jersey, Philadelphia, PA and New York City (all five boroughs)**. It refreshes itself every
morning at **8 AM Eastern** on GitHub's servers, so it keeps running when your laptop is closed.

- Sections: **All · Marketing · Social Media · Brand Marketing · Sales · Saved · Applied**. One
  internship can appear in several sections. Sections are assigned from the title and the job description.
- Industry filters: **Beauty · Fashion · Banking & Financial Services · Agencies · Entertainment**.
  Industry comes from the employer, and filters combine with sections. Internships from other
  industries still show under **All industries**.
- Location and term filters, plus search by company or keyword.
- Each listing shows title, company, location (with a hybrid note when given), role and industry tags,
  term, posting date (or "First found …" when the source gives no date), pay and eligibility when
  stated, and a direct **Apply** link to the employer's posting.
- **Save** and **Mark applied** are stored in your browser and are kept across daily refreshes.
  Use *Export my list* / *Import list* at the bottom of the page to copy them to another device.
- Newest listings come first. Listings the source removes are hidden from results but stay in
  Saved/Applied with a "Closed" badge.
- Excluded: full-time jobs, senior roles, graduate-only internships (MBA, Master's, PhD, JD), fully
  remote roles, and locations that can't be verified (e.g. "Remote – US", "Greater NY Area").

## How it works

```
GitHub Actions (daily, 8 AM ET) ──► scripts/refresh.mjs ──► site/data/listings.json ──► GitHub Pages
        fetch employer job boards       filter, classify, merge            committed to the repo     the website
```

**Sources.** The site uses the public job-board APIs that employers' applicant-tracking systems
publish for automated access:
[Greenhouse](https://developers.greenhouse.io/job-board.html),
[Lever](https://github.com/lever/postings-api),
[Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api) and
[SmartRecruiters](https://developers.smartrecruiters.com/docs/posting-api).
It checks about 130 employer boards, all listed in `config/employers.mjs`. No scraping, and no
API keys are needed.

**Between runs.** Results are stored in `site/data/listings.json`. On each run:
- the same internship posted for several offices or requisitions is merged into one listing (with an
  apply link per office);
- a listing is marked **closed** only when its employer's board loads successfully and no longer
  includes it;
- if a board is down or errors, that employer's last good results are kept and the site's
  *Data sources* section names it;
- if every board fails, nothing is written and the previous data stays live.

`data/last-run-report.json` lists what each board returned and why internships were skipped,
which helps when tuning the rules.

## Change things

| To change… | Edit |
|---|---|
| Allowed locations (add a city or state, include Philly suburbs) | `config/locations.mjs` (one list) |
| Employers checked | `config/employers.mjs` (one line each; instructions at the top) |
| Industry of an employer | the `industries` field in `config/employers.mjs` |
| Keywords for the role sections | `ROLE_RULES` in `scripts/lib/classify.mjs` |

After an edit, push to GitHub. The workflow re-runs automatically, or you can run it locally (below).

**Finding an employer's board id:** open any job on their careers site and look at the URL:
- `job-boards.greenhouse.io/<board>/…` or `boards.greenhouse.io/<board>/…` → `ats: 'greenhouse'`
- `jobs.lever.co/<board>/…` → `ats: 'lever'`
- `jobs.ashbyhq.com/<board>/…` → `ats: 'ashby'`
- `jobs.smartrecruiters.com/<board>/…` → `ats: 'smartrecruiters'`

Many large companies (for example Estée Lauder, L'Oréal, PVH, Comcast, most big banks and holding-company
agencies) use Workday or their own career sites. Those don't offer an open API, so they aren't included.

## Run it on your computer (optional)

Needs [Node.js 22+](https://nodejs.org).

```bash
npm run refresh
```

```bash
npm run serve
```

Then open http://localhost:8080.

```bash
npm test
```

`npm run verify` runs the full browser check (`test/e2e-verify.cjs`). It needs Playwright
(`npm i -D playwright && npx playwright install chromium`) and `npm run serve` running.

## Deploy (free, GitHub)

You need a free GitHub account. GitHub Pages is free for **public** repositories. The listings
are public job postings; your Saved/Applied marks never leave your browser. A private repo with
Pages needs GitHub Pro.

1. **Create the repository.** Go to <https://github.com/new>, name it e.g. `internship-finder`,
   choose **Public**, and **don't** add a README. Click *Create repository*.
2. **Upload this folder.** From inside this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/internship-finder.git
   ```
   ```bash
   git push -u origin main
   ```
3. **Turn on Pages.** In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Allow the workflow to save data.** **Settings → Actions → General → Workflow permissions →
   Read and write permissions → Save.**
5. **Run it once now.** **Actions** tab → *Daily refresh & deploy* → **Run workflow**. When it turns
   green (about a minute), the site is at `https://<your-username>.github.io/internship-finder/`.
   Bookmark it, or on your phone use *Share → Add to Home Screen*.

After that it runs every day at about 8 AM Eastern. GitHub's scheduler can start a few minutes late
at busy times. The *Last successful refresh* time at the top of the site shows when it last ran.

**If a run fails**, GitHub emails you, and the site keeps showing the previous results. Open the
**Actions** tab and the failed run's log to see which employer board failed.
**GitHub pauses scheduled workflows after 60 days with no repository activity.** The daily data
commit counts as activity, so this shouldn't happen. If it does, the Actions tab shows a button to
re-enable the workflow.

## Files

```
config/locations.mjs        allowed locations (edit here)
config/employers.mjs        employer job boards + industries (edit here)
scripts/refresh.mjs         daily refresh: fetch → filter → merge → write
scripts/lib/sources/        Greenhouse / Lever / Ashby / SmartRecruiters adapters
scripts/lib/location.mjs    location parsing + remote/vague detection
scripts/lib/classify.mjs    internship/seniority/grad filters, role sections, term, pay, eligibility
scripts/should-run.mjs      makes the schedule run once at 8 AM Eastern year-round
scripts/serve.mjs           local preview server
site/                       the website (index.html, app.js, style.css, data/listings.json)
.github/workflows/refresh.yml   the daily hosted job
test/                       rule tests, refresh-logic tests, browser verification
```
