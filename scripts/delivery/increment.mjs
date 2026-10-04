/**
 * Creates an increment handoff from configs/delivery/increment-handoff.template.md.
 *
 *   node scripts/delivery/increment.mjs new <slug> [--title "Title"] [--owner name] [--from docs/prds/X.md] [--write]
 *
 * Without --write it prints the handoff (a dry run). --write creates docs/increments/<slug>.md and never
 * overwrites an existing file. --from adds the PRD/PBI/task path to `refs` and takes its title when none is given.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { readyRules } from './rules-ready.mjs';
import { parseFrontmatter } from './handoff.mjs';
import { safeRelative } from './paths.mjs';

const usage = `node scripts/delivery/increment.mjs new <slug> [--title "Title"] [--owner name] [--from <prd|pbi|task path>] [--write]
Prints a new increment handoff from the template; --write creates docs/increments/<slug>.md (never overwrites).`;
const failure = message => Object.assign(new Error(`INCREMENT_USAGE: ${message}`), { code: 'INCREMENT_USAGE' });
const quote = value => `"${String(value).replace(/["\\]/g, '\\$&')}"`;

export function parseIncrementArguments(args) {
  const [command, slug, ...rest] = args;
  if (!command || command === '--help') return { help: true };
  if (command !== 'new') throw failure(`unknown command ${command}`);
  if (!slug || slug.startsWith('--')) throw failure('new needs a <slug>');
  const options = { slug };
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (flag === '--write') { options.write = true; continue; }
    if (!['--title', '--owner', '--from'].includes(flag)) throw failure(`unknown argument ${flag}`);
    const value = rest[++index];
    if (!value || value.startsWith('--')) throw failure(`${flag} needs a value`);
    if (options[flag.slice(2)] !== undefined) throw failure(`duplicate ${flag}`);
    options[flag.slice(2)] = value;
  }
  return options;
}

/** The handoff text for a slug; `source` is the --from file text when given. */
export function renderHandoff(template, { slug, title, owner, from, source }) {
  const sourceTitle = source ? (parseFrontmatter(source.split('\n')).data.title ?? /^# (.+)$/m.exec(source)?.[1]) : null;
  const name = title ?? sourceTitle ?? slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  return template.replaceAll('{{slug}}', slug).replaceAll('"{{title}}"', quote(name)).replaceAll('{{title}}', name)
    .replaceAll('"{{owner}}"', owner ? quote(owner) : '"<owner>"').replaceAll('{{refs}}', from ? from : '');
}

export async function createIncrement(root, args) {
  const options = parseIncrementArguments(args);
  if (options.help) return { help: usage };
  const { delivery } = await loadConfig(root, 'ready', readyRules);
  const settings = delivery.handoff;
  if (!new RegExp(settings.slugPattern, 'u').test(options.slug) || options.slug.length > settings.maxSlugLength) throw failure(`slug "${options.slug}" must match ${settings.slugPattern} and have at most ${settings.maxSlugLength} characters`);
  if (options.from && !safeRelative(options.from)) throw failure('--from must be a repository-relative path');
  const source = options.from ? await readFile(join(root, options.from), 'utf8').catch(() => { throw failure(`--from ${options.from} cannot be read`); }) : null;
  let owner = options.owner;
  if (!owner) try { owner = execFileSync('git', ['config', 'user.name'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined; } catch { owner = undefined; }
  const text = renderHandoff(await readFile(join(root, settings.template), 'utf8'), { ...options, owner, source });
  const path = settings.glob.replace('*', options.slug);
  if (options.write) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text, { flag: 'wx' }).catch(error => { throw error.code === 'EEXIST' ? failure(`${path} exists; it is never overwritten`) : error; });
  }
  return { path, text, written: Boolean(options.write) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await createIncrement(process.cwd(), process.argv.slice(2));
    if (result.help) console.log(result.help);
    else if (result.written) console.log(`Created ${result.path}. Fill it in, then run: npm run dor`);
    else { process.stdout.write(result.text); console.error(`Dry run: add --write to create ${result.path}.`); }
  } catch (error) {
    console.error(error.message);
    process.exitCode = ['INCREMENT_USAGE', 'DELIVERY_CONFIG_INVALID'].includes(error.code) ? 2 : 1;
  }
}
