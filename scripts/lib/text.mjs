const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·', trade: '™', reg: '®', copy: '©' };

export function decodeEntities(s = '') {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** HTML (possibly entity-escaped, as Greenhouse returns it) → plain text with line breaks. */
export function htmlToText(html = '') {
  let s = String(html);
  if (/&lt;\/?[a-z]/i.test(s)) s = decodeEntities(s); // Greenhouse double-encodes
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr|section)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function squish(s = '') {
  return String(s).replace(/\s+/g, ' ').trim();
}

export function normTitle(s = '') {
  return squish(s).toLowerCase().replace(/[‐-―]/g, '-').replace(/[^a-z0-9&+/ -]/g, '').replace(/\s+/g, ' ');
}

export function slug(s = '') {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Short, stable id (FNV-1a 32-bit, base36). */
export function hashId(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

export function toIso(d) {
  if (d == null || d === '') return null;
  const dt = typeof d === 'number' || /^\d+$/.test(String(d)) ? new Date(Number(d)) : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}
