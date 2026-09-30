/** Check authored handbook examples against the live parser without running any command. */
import { readFile, readdir, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
/** Deliberately small quoting grammar for single-line documentation examples; no shell evaluation. */
export function words(line) {
  const result = []; let token = '', quote = '', started = false;
  for (const character of line.trim()) {
    if (quote) { if (character === quote) quote = ''; else token += character; started = true; }
    else if (character === '"' || character === "'") { quote = character; started = true; }
    else if (/\s/.test(character)) { if (started) result.push(token); token = ''; started = false; }
    else { token += character; started = true; }
  }
  if (quote) throw new Error('MANUAL_EXAMPLE_QUOTING: unmatched quote');
  if (started) result.push(token);
  return result;
}
export async function audit(base = root) {
  const { parseCliArguments } = await import(pathToFileURL(join(base, 'scripts/framework/catalog.ts')).href);
  const folder = join(base, 'docs/user-manual/shell-cli');
  const files = (await readdir(folder)).filter(name => name.endsWith('.md')).sort();
  let checked = 0, separateMemory = 0, links = 0;
  for (const name of files) {
    const path = join(folder, name); let fence = '', language = '';
    for (const [index, line] of (await readFile(path, 'utf8')).split('\n').entries()) {
      const marker = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (marker) {
        if (!fence) { fence = marker[1]; language = marker[2].trim(); }
        else if (fence[0] === marker[1][0] && marker[1].length >= fence.length) { fence = ''; language = ''; }
        continue;
      }
      if (fence && language === 'sh' && /^node (?:bin\/app|app\.mjs|shell\.mjs) /.test(line)) {
        const argv = words(line).slice(2);
        if (argv[0] === 'memory') { separateMemory++; continue; }
        try { parseCliArguments(argv); checked++; }
        catch (error) { throw new Error(`MANUAL_EXAMPLE: ${name}:${index + 1}: ${error.message}`); }
      }
      if (!fence) for (const match of line.matchAll(/\[[^\]\n]+\]\(([^\s)]+)\)/g)) {
        const target = match[1]; if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue;
        const local = decodeURIComponent(target.split(/[?#]/, 1)[0]);
        try { await access(resolve(dirname(path), local)); links++; }
        catch { throw new Error(`MANUAL_LINK: ${name}:${index + 1}: ${target}`); }
      }
    }
    if (fence) throw new Error(`MANUAL_FENCE: unclosed code block in ${name}`);
  }
  return { documents: files.length, frameworkExamplesParsed: checked, separateMemoryExamples: separateMemory, relativeLinksChecked: links, commandsExecuted: 0 };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await audit(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
