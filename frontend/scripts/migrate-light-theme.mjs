/**
 * Bir martalik: qorong‘i UI klasslarini light + glass uchun yumshoq almashtirish.
 * Tugmalar / gradientlar ustidagi text-white saqlanadi.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'scripts']);

/** Qator rangli fon yoki gradient tugmasi bo‘lsa, text-white tegilmaydi */
const C =
  'blue|red|green|purple|indigo|cyan|emerald|violet|amber|orange|rose|sky|teal|fuchsia|pink|lime';
const LINE_KEEP_WHITE = new RegExp(
  `bg-(?:${C})-\\d{2,3}(?:/\\d+)?|bg-gradient|from-(?:${C})|to-(?:${C})|variant=\\{?['"]primary['"]\\}?|variant="primary"|variant='primary'|bg-black/`
);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function migrateContent(s) {
  const lines = s.split(/\r?\n/);
  let t = lines
    .map((line) => {
      if (LINE_KEEP_WHITE.test(line)) return line;
      return line.replace(/\btext-white\b/g, 'text-slate-900');
    })
    .join('\n');

  const pairs = [
    [/\btext-gray-200\b/g, 'text-slate-700'],
    [/\btext-gray-300\b/g, 'text-slate-600'],
    [/\btext-gray-400\b/g, 'text-slate-500'],
    [/\btext-gray-500\b/g, 'text-slate-500'],
    [/\bplaceholder-gray-500\b/g, 'placeholder-slate-400'],
    [/\bplaceholder-gray-400\b/g, 'placeholder-slate-400'],
    [/\bborder-gray-600\b/g, 'border-slate-200'],
    [/\bborder-gray-700\b/g, 'border-slate-200'],
    [/\bborder-gray-800\b/g, 'border-slate-200'],
    [/\bbg-gray-950\b/g, 'bg-slate-50/90'],
    [/\bbg-gray-900\b/g, 'bg-white/55'],
    [/\bbg-gray-800\b/g, 'bg-white/50'],
    [/\bbg-gray-700\b/g, 'bg-slate-100/90'],
    [/\bborder-white\/10\b/g, 'border-slate-200/90'],
    [/\bborder-white\/20\b/g, 'border-slate-300/80'],
    [/\bdivide-white\/10\b/g, 'divide-slate-200/80'],
    [/\bbg-white\/5\b/g, 'bg-slate-100/70'],
    [/\bbg-black\/20\b/g, 'bg-white/60'],
    [/\bbg-black\/30\b/g, 'bg-white/65'],
    [/\bbg-black\/50\b/g, 'bg-white/85'],
    [/\bbg-black\/80\b/g, 'bg-slate-900/35'],
    [/\bring-white\/10\b/g, 'ring-slate-200/80'],
  ];

  for (const [re, rep] of pairs) t = t.replace(re, rep);

  return t;
}

const files = walk(ROOT);
let n = 0;
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const next = migrateContent(raw);
  if (next !== raw) {
    fs.writeFileSync(f, next, 'utf8');
    n++;
    console.log('updated', path.relative(ROOT, f));
  }
}
console.log('done, files:', n);
