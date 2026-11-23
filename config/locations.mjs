// ─────────────────────────────────────────────────────────────────────────────
// ALLOWED LOCATIONS — the one place to change where internships may be based.
//
// Each region has:
//   id          short id used in the site's Location filter
//   label       what the site shows
//   state       two-letter state code the office must be in
//   wholeState  true  → any city in that state counts (e.g. all of New Jersey)
//   cities      city / borough names that count. Names in `citiesNoStateNeeded`
//               count even when a posting leaves the state off
//               (e.g. "Brooklyn" or "New York, United States").
//
// To add a region, copy one block. Examples:
//   { id: 'boston', label: 'Boston, MA', state: 'MA', cities: ['boston'], citiesNoStateNeeded: ['boston'] }
//   { id: 'ct', label: 'Connecticut', state: 'CT', wholeState: true }
// To include Philadelphia suburbs, add e.g. 'king of prussia', 'conshohocken' to its `cities`.
// ─────────────────────────────────────────────────────────────────────────────

export const ALLOWED_REGIONS = [
  {
    id: 'nyc',
    label: 'New York City',
    state: 'NY',
    cities: [
      'new york', 'new york city', 'nyc', 'manhattan', 'brooklyn', 'queens', 'bronx', 'the bronx',
      'staten island', 'long island city', 'astoria', 'flushing', 'harlem', 'dumbo', 'williamsburg',
      'jamaica', 'jackson heights', 'ridgewood', 'bushwick', 'greenpoint', 'midtown', 'soho', 'tribeca',
      'chelsea', 'financial district', 'hudson yards', 'brooklyn navy yard',
    ],
    // Safe to accept without a state (they don't collide with well-known places elsewhere).
    citiesNoStateNeeded: ['new york', 'new york city', 'nyc', 'manhattan', 'brooklyn', 'queens', 'bronx', 'the bronx', 'staten island', 'long island city'],
  },
  {
    id: 'philadelphia',
    label: 'Philadelphia, PA',
    state: 'PA',
    cities: ['philadelphia', 'philly'],
    citiesNoStateNeeded: ['philadelphia', 'philly'],
  },
  {
    id: 'nj',
    label: 'New Jersey',
    state: 'NJ',
    wholeState: true,
    // NJ cities whose names are unambiguous enough to accept when a posting omits "NJ".
    citiesNoStateNeeded: [
      'jersey city', 'hoboken', 'weehawken', 'secaucus', 'parsippany', 'east rutherford', 'new brunswick',
      'piscataway', 'mahwah', 'rahway', 'hackensack',
      'paramus', 'fort lee', 'iselin', 'whippany', 'florham park', 'basking ridge',
      'woodcliff lake', 'englewood cliffs', 'moorestown', 'cherry hill','kenilworth', 'red bank', 'berkeley heights', 'montvale', 'lyndhurst', 
    ],
  },
];

// State names → codes, for postings that spell the state out.
export const STATE_NAMES = {
  'new york': 'NY', 'new jersey': 'NJ', 'pennsylvania': 'PA', 'connecticut': 'CT', 'massachusetts': 'MA',
  'california': 'CA', 'illinois': 'IL', 'texas': 'TX', 'florida': 'FL', 'washington': 'WA', 'georgia': 'GA',
  'colorado': 'CO', 'delaware': 'DE', 'maryland': 'MD', 'virginia': 'VA', 'district of columbia': 'DC',
  'ohio': 'OH', 'michigan': 'MI', 'minnesota': 'MN', 'oregon': 'OR', 'arizona': 'AZ', 'north carolina': 'NC',
  'tennessee': 'TN', 'utah': 'UT', 'missouri': 'MO', 'wisconsin': 'WI', 'indiana': 'IN', 'new hampshire': 'NH',
  'rhode island': 'RI', 'vermont': 'VT', 'maine': 'ME', 'nevada': 'NV', 'kentucky': 'KY', 'louisiana': 'LA',
  'oklahoma': 'OK', 'south carolina': 'SC', 'alabama': 'AL', 'kansas': 'KS', 'iowa': 'IA', 'nebraska': 'NE',
};
