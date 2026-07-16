/**
 * Och sariq/yashil/ko‘k matnlarni yorug‘ fon ustida yaxshi ko‘rinadigan to‘q ranglarga almashtiradi.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SKIP = new Set(['node_modules', 'dist', 'scripts']);

/** Tartib muhim: uzunroq qatorlar birinchi */
const PAIRS = [
  ['hover:text-blue-300', 'hover:text-blue-700'],
  ['group-hover:text-emerald-300', 'group-hover:text-emerald-800'],
  ['group-hover:text-blue-300', 'group-hover:text-blue-800'],
  ['text-yellow-200/90', 'text-yellow-950'],
  ['text-amber-200/90', 'text-amber-950'],
  ['text-green-400/80', 'text-emerald-900'],
  ['text-yellow-300', 'text-yellow-900'],
  ['text-yellow-400', 'text-yellow-800'],
  ['text-yellow-200', 'text-yellow-950'],
  ['text-amber-300', 'text-amber-900'],
  ['text-amber-200', 'text-amber-950'],
  ['text-amber-400', 'text-amber-800'],
  ['text-green-300', 'text-emerald-900'],
  ['text-green-400', 'text-emerald-800'],
  ['text-green-500', 'text-green-800'],
  ['text-emerald-300', 'text-emerald-900'],
  ['text-emerald-400', 'text-emerald-800'],
  ['text-teal-300', 'text-teal-900'],
  ['text-teal-400', 'text-teal-800'],
  ['text-lime-400', 'text-lime-800'],
  ['text-cyan-300', 'text-cyan-900'],
  ['text-cyan-400', 'text-cyan-800'],
  ['text-orange-300', 'text-orange-900'],
  ['text-orange-400', 'text-orange-800'],
  ['text-blue-300', 'text-blue-900'],
  ['text-blue-400', 'text-blue-800'],
  ['text-purple-300', 'text-purple-900'],
  ['text-red-300', 'text-red-800'],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

let files = 0;
for (const f of walk(ROOT)) {
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  for (const [a, b] of PAIRS) {
    s = s.split(a).join(b);
  }
  if (s !== orig) {
    fs.writeFileSync(f, s, 'utf8');
    files++;
    console.log(path.relative(ROOT, f));
  }
}
console.log('updated', files, 'files');
