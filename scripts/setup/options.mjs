import { readFile } from 'node:fs/promises';
const values = new Set(['id', 'name', 'description', 'author', 'repo', 'version', 'profile', 'answers', 'migrate-from']);
const switches = new Set(['yes', 'no-interaction', 'dry-run', 'skip-install', 'no-local', 'help', 'json', 'resume', 'provision-browser']);
const identityKeys = ['id', 'name', 'description', 'author', 'repo', 'version'];
export async function setupOptions(args) {
  const supplied = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    const key = arg.slice(2);
    if (Object.hasOwn(supplied, key)) throw new Error(`Repeated option: ${arg}`);
    if (switches.has(key)) supplied[key] = true;
    else if (values.has(key)) {
      const value = args[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value: ${arg}`);
      supplied[key] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  let answers = {};
  if (supplied.answers) {
    answers = JSON.parse(await readFile(supplied.answers, 'utf8'));
    if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Answers must be a data-only JSON object');
    for (const [key, value] of Object.entries(answers)) {
      if ((!values.has(key) || key === 'answers') && !['skip-install', 'no-local', 'provision-browser'].includes(key)) throw new Error(`Unknown answer key: ${key}`);
      if (values.has(key) ? typeof value !== 'string' : typeof value !== 'boolean') throw new Error(`Invalid answer value: ${key}`);
    }
  }
  const options = { ...answers, ...supplied };
  if (options.profile && !['browser', 'native'].includes(options.profile)) throw new Error('Profile must be browser or native');
  if (options['no-local'] && options.profile === 'native') throw new Error('--no-local conflicts with --profile native');
  return { ...options, profile: options.profile ?? 'browser', explicitKeys: Object.keys(options), identityRequested: identityKeys.some(key => Object.hasOwn(options, key)) };
}
export function savedOptions(options) {
  return Object.fromEntries([...identityKeys, 'profile', 'migrate-from', 'skip-install', 'provision-browser'].filter(key => options[key] !== undefined).map(key => [key, options[key]]));
}
export async function resumeOptions(current, saved) {
  const args = [];
  for (const [key, value] of Object.entries(saved)) {
    if (![...identityKeys, 'profile', 'migrate-from', 'skip-install', 'provision-browser'].includes(key)) throw new Error('Unknown saved setup option');
    if (typeof value === 'boolean') { if (!switches.has(key)) throw new Error('Invalid saved setup option'); if (value) args.push(`--${key}`); }
    else if (typeof value === 'string' && values.has(key)) args.push(`--${key}`, value);
    else throw new Error('Invalid saved setup option');
  }
  const previous = await setupOptions(args);
  const overrides = Object.fromEntries(current.explicitKeys.map(key => [key, current[key]]));
  const result = { ...previous, ...overrides, explicitKeys: current.explicitKeys };
  result.identityRequested = identityKeys.some(key => Object.hasOwn(result, key));
  if (result['no-local']) result.profile = 'browser';
  return result;
}
export const setupHelp = `npm run setup -- [--id ID --name NAME --description TEXT --author NAME --repo OWNER/REPO --version VERSION]
  [--profile browser|native] [--provision-browser] [--migrate-from OLD-ID]
  [--answers FILE] [--resume] [--yes --no-interaction] [--dry-run] [--json]
  [--skip-install] [--no-local] [--help]
Default: browser profile. Native installation is limited to .dev-vault.
Installed identity migration requires both old/new plugins disabled and preserves the old installation.
Dry run is read-only and works without dependencies. Answers are data, never executable hooks.`;
