#!/usr/bin/env node
// Used by the GitHub Actions schedule. GitHub cron runs in UTC, so the workflow fires at
// both 12:05 and 13:05 UTC; this gate lets exactly one of them refresh, at ~8 AM Eastern,
// in both daylight-saving and standard time. Prints "true" or "false".
import { readFile } from 'node:fs/promises';

const TZ = 'America/New_York';
const RUN_HOUR = 8;

const parts = d => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
  .formatToParts(d).map(p => [p.type, p.value]));

const now = parts(new Date());
const today = `${now.year}-${now.month}-${now.day}`;
let ranToday = false;
try {
  const data = JSON.parse(await readFile(new URL('../site/data/listings.json', import.meta.url), 'utf8'));
  const last = parts(new Date(data.lastSuccessfulRefresh));
  ranToday = `${last.year}-${last.month}-${last.day}` === today && Number(last.hour) >= RUN_HOUR;
} catch { /* no data yet */ }

console.log(String(Number(now.hour) >= RUN_HOUR && !ranToday));
