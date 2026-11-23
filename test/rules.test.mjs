import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLocations } from '../scripts/lib/location.mjs';
import { internshipCheck, classifyRoles, detectTerm, extractPay } from '../scripts/lib/classify.mjs';

const loc = (l, wt) => evaluateLocations(Array.isArray(l) ? l : [l], wt);

test('allowed locations: NYC (all five boroughs), Philadelphia, New Jersey', () => {
  for (const s of ['New York, NY', 'New York, New York, United States', 'New York City', 'NYC', 'New York', 'Brooklyn, NY', 'Queens', 'The Bronx, NY', 'Staten Island, New York', 'Long Island City, NY', 'Manhattan', 'US-NY-New York']) {
    assert.deepEqual(loc(s).regions, ['nyc'], s);
  }
  for (const s of ['Philadelphia, PA', 'Philadelphia, Pennsylvania, United States', 'Philadelphia']) assert.deepEqual(loc(s).regions, ['philadelphia'], s);
  for (const s of ['Jersey City, NJ', 'Hoboken', 'Newark, New Jersey', 'Princeton, NJ', 'North Bergen, NJ', 'New Jersey']) assert.deepEqual(loc(s).regions, ['nj'], s);
  assert.deepEqual(loc({ city: 'New York', state: 'NEW YORK' }).regions, ['nyc']);
});

test('rejected locations: elsewhere, fully remote, vague', () => {
  for (const s of ['San Francisco, CA', 'Pittsburgh, PA', 'King of Prussia, PA', 'Albany, NY', 'Newark, DE', 'Stamford, CT', 'London', 'Remote', 'Remote - US', 'Remote - New York', 'New York (Remote)', 'United States', 'Greater New York Area', 'New York Metropolitan Area', 'Northeast', 'Jamaica', '']) {
    assert.equal(loc(s).ok, false, s);
  }
  assert.equal(loc('New York, NY', 'remote').ok, false, 'workplaceType remote overrides city');
  assert.equal(loc({ city: 'New York', state: 'NY', remote: true }).ok, false);
});

test('hybrid roles with an allowed office are kept', () => {
  const r = loc('Hybrid - New York, NY');
  assert.equal(r.ok, true);
  assert.equal(r.workplace, 'hybrid');
  assert.equal(loc('New York, NY', 'Hybrid').workplace, 'hybrid');
  assert.equal(loc({ city: 'New York', state: 'NY', hybrid: true }).workplace, 'hybrid');
});

test('multi-location postings keep only allowed offices', () => {
  const r = loc('San Francisco, CA; New York, NY; Philadelphia, PA');
  assert.deepEqual(r.regions.sort(), ['nyc', 'philadelphia']);
  assert.deepEqual(r.labels, ['New York, NY', 'Philadelphia, PA']);
});

test('internship filter: excludes full-time, senior and graduate-only roles', () => {
  assert.equal(internshipCheck({ title: 'Marketing Intern, Summer 2027' }).ok, true);
  assert.equal(internshipCheck({ title: 'Sales and Trading', employmentType: 'Summer Internship' }).ok, true);
  assert.equal(internshipCheck({ title: 'Brand Marketing Manager' }).ok, false);
  assert.equal(internshipCheck({ title: 'International Marketing Coordinator' }).ok, false);
  assert.equal(internshipCheck({ title: 'Senior Marketing Intern Program Manager' }).ok, false);
  assert.equal(internshipCheck({ title: 'MBA Brand Marketing Intern' }).ok, false);
  assert.equal(internshipCheck({ title: 'Marketing Intern', text: 'You are currently enrolled in an MBA program.' }).ok, false);
  assert.equal(internshipCheck({ title: 'Marketing Intern', text: 'Open to undergraduate or MBA students.' }).ok, true);
});

test('role sections use title and description; a job can be in several', () => {
  assert.deepEqual(classifyRoles({ title: 'Brand Strategy Intern' }), ['Marketing', 'Brand Marketing']);
  assert.deepEqual(classifyRoles({ title: 'Social Media Intern' }), ['Marketing', 'Social Media']);
  assert.deepEqual(classifyRoles({ title: 'Ad Sales Intern' }), ['Sales']);
  assert.deepEqual(classifyRoles({ title: 'Software Engineering Intern', text: 'marketing marketing marketing marketing marketing marketing' }), []);
  assert.deepEqual(classifyRoles({ title: 'Advertising & Partnerships: Data Science Internship' }), []);
  const generic = classifyRoles({
    title: '2027 Summer Intern Program (New York)', company: "Sotheby's",
    text: 'Departments: Marketing, Business Development and Sales. Marketing interns support marketing campaigns and brand strategy and brand awareness.',
  });
  assert.ok(generic.includes('Marketing') && generic.includes('Sales') && generic.includes('Brand Marketing'), generic.join());
  assert.deepEqual(classifyRoles({ title: 'Corporate Finance Intern (Summer 2027)', text: 'sales sales sales marketing' }), []);
});

test('term detection', () => {
  assert.deepEqual(detectTerm({ title: 'Marketing Intern - Summer 2027' }), { term: 'Summer 2027', inferred: false });
  assert.deepEqual(detectTerm({ title: '2027 Summer Intern Program' }), { term: 'Summer 2027', inferred: false });
  assert.deepEqual(detectTerm({ title: "Marketing Intern (Summer '27)" }), { term: 'Summer 2027', inferred: false });
  assert.deepEqual(detectTerm({ title: 'PR Intern, Spring 2027' }), { term: 'Spring 2027', inferred: false });
  assert.deepEqual(detectTerm({ title: 'Audience Fellowship (January 2027)' }), { term: 'Spring 2027', inferred: false });
  assert.deepEqual(detectTerm({ title: 'Marketing Intern', text: 'The program runs June 7 to August 13, 2027.' }), { term: 'Summer 2027', inferred: false });
  assert.deepEqual(detectTerm({ title: 'Summer Marketing Intern', postedAt: '2026-11-20T00:00:00Z' }), { term: 'Summer 2027', inferred: true });
  assert.deepEqual(detectTerm({ title: 'Sales and Trading', text: 'Employment Type: Summer Internship\nPlanning to graduate in 2028', postedAt: '2026-01-16T00:00:00Z' }), { term: 'Summer 2027', inferred: true });
  assert.equal(detectTerm({ title: 'Social Intern' }).term, 'Term not stated');
});

test('pay extraction', () => {
  assert.equal(extractPay('Interns are paid an hourly rate of US $22.00'), '$22.00/hour');
  assert.equal(extractPay('The pay range for this role is $20 - $25 per hour.'), '$20 - $25 per hour');
  assert.equal(extractPay('We have $5B in assets.'), null);
});
