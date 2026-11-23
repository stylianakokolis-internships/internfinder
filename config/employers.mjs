// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYERS — the job boards checked on every refresh.
//
// Each employer is one line:
//   { name, ats, board, industries }
//
//   ats         which public job-board API the employer uses:
//                 'greenhouse'      → https://boards-api.greenhouse.io/v1/boards/<board>/jobs
//                 'lever'           → https://api.lever.co/v0/postings/<board>
//                 'ashby'           → https://api.ashbyhq.com/posting-api/job-board/<board>
//                 'smartrecruiters' → https://api.smartrecruiters.com/v1/companies/<board>/postings
//   board       the employer's id on that system. It appears in the employer's
//               careers-page URL, e.g. job-boards.greenhouse.io/<board>,
//               jobs.lever.co/<board>, jobs.ashbyhq.com/<board>,
//               jobs.smartrecruiters.com/<board>.
//   industries  employer's industry. Use the filter names below so they show up
//               under the site's industry filters; any other text (e.g.
//               'Technology') is shown as a tag and stays visible under "All".
//
// To add an employer: open their careers page, apply to any job, look at the URL
// to find the ats + board, add a line, then run `npm run refresh` (or wait for
// the next daily run). The refresh log says if a board id is wrong.
//
// These APIs are published by the job-board vendors for public, automated
// access to an employer's open postings.
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_FILTERS = ['Beauty', 'Fashion', 'Banking & Financial Services', 'Agencies', 'Entertainment'];

const BEAUTY = 'Beauty';
const FASHION = 'Fashion';
const FIN = 'Banking & Financial Services';
const AGENCY = 'Agencies';
const ENT = 'Entertainment';

export const EMPLOYERS = [
  // ── Beauty ────────────────────────────────────────────────────────────────
  { name: 'Glossier', ats: 'greenhouse', board: 'glossier', industries: [BEAUTY] },
  { name: 'Sol de Janeiro', ats: 'greenhouse', board: 'soldejaneiro', industries: [BEAUTY] },
  { name: 'Supergoop!', ats: 'greenhouse', board: 'supergoop', industries: [BEAUTY] },
  { name: "Harry's", ats: 'greenhouse', board: 'harrys', industries: [BEAUTY] },
  { name: 'Billie', ats: 'ashby', board: 'billie', industries: [BEAUTY] },

  // ── Fashion ───────────────────────────────────────────────────────────────
  { name: 'Rent the Runway', ats: 'greenhouse', board: 'renttherunway', industries: [FASHION] },
  { name: 'Reformation', ats: 'greenhouse', board: 'reformation', industries: [FASHION] },
  { name: 'Everlane', ats: 'greenhouse', board: 'everlane', industries: [FASHION] },
  { name: 'Aimé Leon Dore', ats: 'greenhouse', board: 'aimeleondore', industries: [FASHION] },
  { name: 'Veronica Beard', ats: 'greenhouse', board: 'veronicabeard', industries: [FASHION] },
  { name: 'ThirdLove', ats: 'greenhouse', board: 'thirdlove', industries: [FASHION] },
  { name: 'Cuyana', ats: 'greenhouse', board: 'cuyana', industries: [FASHION] },
  { name: 'Mejuri', ats: 'greenhouse', board: 'mejuri', industries: [FASHION] },
  { name: 'BaubleBar', ats: 'greenhouse', board: 'baublebar', industries: [FASHION] },
  { name: 'Rebag', ats: 'greenhouse', board: 'rebag', industries: [FASHION] },
  { name: 'StockX', ats: 'greenhouse', board: 'stockx', industries: [FASHION] },
  { name: 'Alo Yoga', ats: 'greenhouse', board: 'aloyoga', industries: [FASHION] },
  { name: 'The Business of Fashion', ats: 'greenhouse', board: 'businessoffashion', industries: [FASHION] },
  { name: 'Good American', ats: 'lever', board: 'goodamerican', industries: [FASHION] },
  { name: 'Vestiaire Collective', ats: 'lever', board: 'vestiairecollective', industries: [FASHION] },
  { name: 'Hypebeast', ats: 'lever', board: 'hypebeast', industries: [FASHION] },
  { name: 'FARFETCH', ats: 'ashby', board: 'farfetch', industries: [FASHION] },
  { name: 'Poshmark', ats: 'ashby', board: 'poshmark', industries: [FASHION] },

  // ── Banking & Financial Services ─────────────────────────────────────────
  { name: 'Robinhood', ats: 'greenhouse', board: 'robinhood', industries: [FIN] },
  { name: 'Stripe', ats: 'greenhouse', board: 'stripe', industries: [FIN] },
  { name: 'Brex', ats: 'greenhouse', board: 'brex', industries: [FIN] },
  { name: 'Affirm', ats: 'greenhouse', board: 'affirm', industries: [FIN] },
  { name: 'Chime', ats: 'greenhouse', board: 'chime', industries: [FIN] },
  { name: 'SoFi', ats: 'greenhouse', board: 'sofi', industries: [FIN] },
  { name: 'Betterment', ats: 'greenhouse', board: 'betterment', industries: [FIN] },
  { name: 'Point72', ats: 'greenhouse', board: 'point72', industries: [FIN] },
  { name: 'Bridgewater Associates', ats: 'greenhouse', board: 'bridgewater89', industries: [FIN] },
  { name: 'Schonfeld', ats: 'greenhouse', board: 'schonfeld', industries: [FIN] },
  { name: 'Gemini', ats: 'greenhouse', board: 'gemini', industries: [FIN] },
  { name: 'Galaxy', ats: 'greenhouse', board: 'galaxydigitalservices', industries: [FIN] },
  { name: 'Five Rings', ats: 'greenhouse', board: 'fiveringsllc', industries: [FIN] },
  { name: 'Graham Capital Management', ats: 'greenhouse', board: 'grahamcapitalmanagement', industries: [FIN] },
  { name: 'Mercury', ats: 'greenhouse', board: 'mercury', industries: [FIN] },
  { name: 'Payoneer', ats: 'greenhouse', board: 'payoneer', industries: [FIN] },
  { name: 'AQR Capital Management', ats: 'greenhouse', board: 'aqr', industries: [FIN] },
  { name: 'Jane Street', ats: 'greenhouse', board: 'janestreet', industries: [FIN] },
  { name: 'Clear Street', ats: 'greenhouse', board: 'clearstreet', industries: [FIN] },
  { name: 'Carta', ats: 'greenhouse', board: 'carta', industries: [FIN] },
  { name: 'Public.com', ats: 'greenhouse', board: 'public', industries: [FIN] },
  { name: 'Wealthfront', ats: 'lever', board: 'wealthfront', industries: [FIN] },
  { name: 'Ramp', ats: 'ashby', board: 'ramp', industries: [FIN] },
  { name: 'Plaid', ats: 'ashby', board: 'plaid', industries: [FIN] },
  { name: 'Paxos', ats: 'ashby', board: 'paxos', industries: [FIN] },
  { name: 'Acorns', ats: 'ashby', board: 'acorns', industries: [FIN] },
  { name: 'NerdWallet', ats: 'ashby', board: 'nerdwallet', industries: [FIN] },

  // ── Agencies (marketing, advertising, PR, creative) ──────────────────────
  { name: 'VaynerMedia', ats: 'greenhouse', board: 'vaynermedia', industries: [AGENCY] },
  { name: 'Code and Theory', ats: 'greenhouse', board: 'codeandtheory', industries: [AGENCY] },
  { name: 'Huge', ats: 'greenhouse', board: 'hugeinc', industries: [AGENCY] },
  { name: 'R/GA', ats: 'greenhouse', board: 'rga', industries: [AGENCY] },
  { name: 'Monks', ats: 'greenhouse', board: 'monks', industries: [AGENCY] },
  { name: 'DEPT', ats: 'greenhouse', board: 'dept', industries: [AGENCY] },
  { name: 'Weber Shandwick', ats: 'greenhouse', board: 'webershandwick', industries: [AGENCY] },
  { name: 'WPP', ats: 'greenhouse', board: 'wpp', industries: [AGENCY] },
  { name: 'Interbrand', ats: 'greenhouse', board: 'interbrand', industries: [AGENCY] },
  { name: 'FleishmanHillard', ats: 'greenhouse', board: 'fleishmanhillard', industries: [AGENCY] },
  { name: 'Prophet', ats: 'greenhouse', board: 'prophet', industries: [AGENCY] },
  { name: 'Landor', ats: 'greenhouse', board: 'landor', industries: [AGENCY] },
  { name: 'AKQA', ats: 'greenhouse', board: 'akqa', industries: [AGENCY] },
  { name: 'RAPP', ats: 'greenhouse', board: 'rapp', industries: [AGENCY] },
  { name: '5WPR', ats: 'greenhouse', board: '5wpr', industries: [AGENCY] },
  { name: 'BerlinRosen', ats: 'greenhouse', board: 'berlinrosen', industries: [AGENCY] },
  { name: 'Golin', ats: 'greenhouse', board: 'golin', industries: [AGENCY] },
  { name: 'M Booth', ats: 'greenhouse', board: 'mbooth', industries: [AGENCY] },
  { name: 'Octagon', ats: 'greenhouse', board: 'octagon', industries: [AGENCY] },
  { name: 'Wieden+Kennedy', ats: 'greenhouse', board: 'wk', industries: [AGENCY] },
  { name: 'Power Digital', ats: 'greenhouse', board: 'powerdigitalmarketing', industries: [AGENCY] },
  { name: 'Whalar', ats: 'greenhouse', board: 'whalar', industries: [AGENCY] },
  { name: 'Ekimetrics', ats: 'lever', board: 'ekimetrics', industries: [AGENCY] },
  { name: 'Anomaly', ats: 'lever', board: 'anomaly', industries: [AGENCY] },
  { name: 'Jellyfish', ats: 'ashby', board: 'jellyfish', industries: [AGENCY] },

  // ── Entertainment (incl. media, sports, music, gaming) ───────────────────
  { name: 'NBCUniversal', ats: 'smartrecruiters', board: 'NBCUniversal3', industries: [ENT] },
  { name: 'The New York Times', ats: 'greenhouse', board: 'thenewyorktimes', industries: [ENT] },
  { name: 'Vox Media', ats: 'greenhouse', board: 'voxmedia', industries: [ENT] },
  { name: 'BuzzFeed', ats: 'greenhouse', board: 'buzzfeed', industries: [ENT] },
  { name: 'A24', ats: 'greenhouse', board: 'a24', industries: [ENT] },
  { name: 'Insider', ats: 'greenhouse', board: 'insider', industries: [ENT] },
  { name: 'Hearst', ats: 'greenhouse', board: 'hearst', industries: [ENT] },
  { name: 'Penske Media', ats: 'greenhouse', board: 'pmc', industries: [ENT] },
  { name: 'Axios', ats: 'greenhouse', board: 'axios', industries: [ENT] },
  { name: 'Barstool Sports', ats: 'greenhouse', board: 'barstoolsports', industries: [ENT] },
  { name: 'SeatGeek', ats: 'greenhouse', board: 'seatgeek', industries: [ENT] },
  { name: 'Roku', ats: 'greenhouse', board: 'roku', industries: [ENT] },
  { name: 'Fubo', ats: 'greenhouse', board: 'fubotv', industries: [ENT] },
  { name: 'Roblox', ats: 'greenhouse', board: 'roblox', industries: [ENT] },
  { name: 'Epic Games', ats: 'greenhouse', board: 'epicgames', industries: [ENT] },
  { name: 'Riot Games', ats: 'greenhouse', board: 'riotgames', industries: [ENT] },
  { name: 'Take-Two Interactive', ats: 'greenhouse', board: 'taketwo', industries: [ENT] },
  { name: 'FanDuel', ats: 'greenhouse', board: 'fanduel', industries: [ENT] },
  { name: 'Fever', ats: 'greenhouse', board: 'feverup', industries: [ENT] },
  { name: 'Philadelphia Eagles', ats: 'greenhouse', board: 'philadelphiaeagles', industries: [ENT] },
  { name: 'Spotify', ats: 'lever', board: 'spotify', industries: [ENT] },
  { name: 'Complex', ats: 'lever', board: 'Complex', industries: [ENT] },
  { name: 'The Athletic', ats: 'lever', board: 'theathletic', industries: [ENT] },
  { name: 'Morning Brew', ats: 'lever', board: 'morningbrew', industries: [ENT] },
  { name: 'Patreon', ats: 'ashby', board: 'patreon', industries: [ENT] },
  { name: 'Substack', ats: 'ashby', board: 'substack', industries: [ENT] },

  // ── Other industries (shown under "All") ─────────────────────────────────
  { name: "Sotheby's", ats: 'greenhouse', board: 'sothebys', industries: ['Art & Luxury'] },
  { name: 'MongoDB', ats: 'greenhouse', board: 'mongodb', industries: ['Technology'] },
  { name: 'Datadog', ats: 'greenhouse', board: 'datadog', industries: ['Technology'] },
  { name: 'Braze', ats: 'greenhouse', board: 'braze', industries: ['Technology'] },
  { name: 'Attentive', ats: 'greenhouse', board: 'attentive', industries: ['Technology'] },
  { name: 'Klaviyo', ats: 'greenhouse', board: 'klaviyo', industries: ['Technology'] },
  { name: 'Justworks', ats: 'greenhouse', board: 'justworks', industries: ['Technology'] },
  { name: 'Yext', ats: 'greenhouse', board: 'yext', industries: ['Technology'] },
  { name: 'Squarespace', ats: 'greenhouse', board: 'squarespace', industries: ['Technology'] },
  { name: 'Pinterest', ats: 'greenhouse', board: 'pinterest', industries: ['Technology'] },
  { name: 'Reddit', ats: 'greenhouse', board: 'reddit', industries: ['Technology'] },
  { name: 'Discord', ats: 'greenhouse', board: 'discord', industries: ['Technology'] },
  { name: 'Figma', ats: 'greenhouse', board: 'figma', industries: ['Technology'] },
  { name: 'Duolingo', ats: 'greenhouse', board: 'duolingo', industries: ['Technology'] },
  { name: 'Later', ats: 'greenhouse', board: 'later', industries: ['Technology'] },
  { name: 'ZipRecruiter', ats: 'greenhouse', board: 'ziprecruiter', industries: ['Technology'] },
  { name: 'Airbnb', ats: 'greenhouse', board: 'airbnb', industries: ['Travel & Hospitality'] },
  { name: 'Zocdoc', ats: 'greenhouse', board: 'zocdoc', industries: ['Health'] },
  { name: 'Oscar Health', ats: 'greenhouse', board: 'oscar', industries: ['Health'] },
  { name: 'Flatiron Health', ats: 'greenhouse', board: 'flatironhealth', industries: ['Health'] },
  { name: 'HelloFresh', ats: 'greenhouse', board: 'hellofresh', industries: ['Food & Beverage'] },
  { name: 'Sweetgreen', ats: 'greenhouse', board: 'sweetgreen', industries: ['Food & Beverage'] },
  { name: 'Olipop', ats: 'greenhouse', board: 'olipop', industries: ['Food & Beverage'] },
  { name: 'Misfits Market', ats: 'greenhouse', board: 'misfitsmarket', industries: ['Food & Beverage'] },
  { name: 'Instacart', ats: 'greenhouse', board: 'instacart', industries: ['Retail & Consumer'] },
  { name: 'Peloton', ats: 'greenhouse', board: 'peloton', industries: ['Fitness'] },
  { name: 'Equinox', ats: 'smartrecruiters', board: 'Equinox', industries: ['Fitness'] },
  { name: 'Away', ats: 'ashby', board: 'away', industries: ['Retail & Consumer'] },
  { name: 'Brooklinen', ats: 'ashby', board: 'brooklinen', industries: ['Retail & Consumer'] },
  { name: 'Notion', ats: 'ashby', board: 'notion', industries: ['Technology'] },
  { name: 'Palantir', ats: 'lever', board: 'palantir', industries: ['Technology'] },
  { name: 'Stand Together', ats: 'lever', board: 'standtogether', industries: ['Nonprofit'] },
];
