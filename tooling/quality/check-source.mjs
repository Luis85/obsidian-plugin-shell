import { sourceInputs } from '../testing/source-inputs.mjs';
import { readFile } from 'node:fs/promises';
const result = await sourceInputs(process.cwd());
for (const file of result.files) if (file.limit !== null && file.lines > file.limit) throw new Error(`SOURCE_LINE_LIMIT ${file.path}: ${file.lines}/${file.limit}`);
const locales = await Promise.all(['en', 'de'].map(async locale => JSON.parse(await readFile(`src/locales/${locale}.json`, 'utf8'))));
function keys(value, prefix = '') { return Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [prefix + key] : keys(item, `${prefix}${key}.`)).sort(); }
if (JSON.stringify(keys(locales[0])) !== JSON.stringify(keys(locales[1]))) throw new Error('LOCALE_KEYS_MISMATCH');
console.log(`Code-line limits (excluding comments/blanks) and locale parity passed; ${result.files.length} inputs, ${keys(locales[0]).length} translated keys.`);
