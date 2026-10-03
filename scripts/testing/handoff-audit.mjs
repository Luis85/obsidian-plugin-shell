/** What a fresh clone of a pushed project must (not) carry, judged only from tracked files: the audit part of the handoff qualification. */
const REQUIRED_EXECUTABLES = ['bin/app', 'scripts/agent/cloud-setup.sh'];
const LINE_ENDING_SENSITIVE = /^(?:scripts\/agent\/|bin\/app$|\.nvmrc$|[^/]*\.sh$)/;
const MAX_TEXT_BYTES = 3_000_000;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides'];
/** Parse `git ls-files -s` output into `{mode, path}` rows. */
export function parseIndex(text) {
  return String(text ?? '').split('\n').flatMap(line => {
    const match = /^(\d{6}) [0-9a-f]+ \d\t(.+)$/.exec(line);
    return match ? [{ mode: match[1], path: match[2] }] : [];
  });
}
const finding = (check, detail, path) => ({ check, detail, ...(path ? { path } : {}) });
const parse = text => { try { return JSON.parse(text); } catch { return null; } };
const isLocalSpec = spec => typeof spec === 'string' && /^(?:file:|link:|git\+file:|\/|[A-Za-z]:[\\/]|\.\.?[\\/])/.test(spec);
function localSpecs(value, path = '') {
  if (isLocalSpec(value)) return [`${path}=${value}`];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, inner]) => localSpecs(inner, path ? `${path}.${key}` : key));
}
function structureFindings(entries) {
  const paths = new Set(entries.map(entry => entry.path));
  const found = [];
  if (!paths.has('package-lock.json')) found.push(finding('lockfile', 'package-lock.json is not tracked, so npm ci cannot reproduce the install'));
  if (!paths.has('.claude/settings.json')) found.push(finding('claude-settings', '.claude/settings.json is not tracked, so a cloud session gets no hooks'));
  if (paths.has('.claude/settings.local.json')) found.push(finding('claude-settings', 'personal .claude/settings.local.json is tracked', '.claude/settings.local.json'));
  for (const entry of entries) if (entry.mode === '120000') found.push(finding('symlink', 'a symbolic link would point at the maintainer machine after a clone', entry.path));
  for (const path of REQUIRED_EXECUTABLES) {
    const entry = entries.find(item => item.path === path);
    if (entry && entry.mode !== '100755') found.push(finding('executable-bit', `${path} is tracked as ${entry.mode}, not 100755`, path));
  }
  return found;
}
function hookFindings(settingsText, paths) {
  const settings = parse(settingsText);
  if (!settings) return [finding('claude-settings', '.claude/settings.json is not valid JSON', '.claude/settings.json')];
  const commands = Object.values(settings.hooks ?? {}).flat().flatMap(group => group.hooks ?? []).map(hook => String(hook.command ?? ''));
  return commands.flatMap(command => {
    const script = /\$CLAUDE_PROJECT_DIR\/([^"\s]+)/.exec(command)?.[1];
    return script && !paths.has(script) ? [finding('claude-settings', `hook runs ${script}, which is not tracked`, '.claude/settings.json')] : [];
  });
}
function dependencyFindings(packageText, lockText) {
  const pkg = parse(packageText); const lock = parse(lockText);
  const found = [];
  for (const field of DEPENDENCY_FIELDS) for (const spec of localSpecs(pkg?.[field], field)) found.push(finding('local-dependency', `package.json ${spec} points at a local path`, 'package.json'));
  for (const [name, entry] of Object.entries(lock?.packages ?? {})) {
    if (entry?.link === true || String(entry?.resolved ?? '').startsWith('file:')) found.push(finding('local-dependency', `package-lock.json entry ${name || '(root)'} is a local link`, 'package-lock.json'));
  }
  return found;
}
/** @param {{mode:string, path:string}[]} entries tracked files
 * @param {{read:(path:string)=>Buffer|null, forbidden:string[]}} context file reader and strings that must not appear (maintainer checkout, scratch directories)
 * @returns {{check:string, detail:string, path?:string}[]} */
export function auditTracked(entries, { read, forbidden }) {
  const paths = new Set(entries.map(entry => entry.path));
  const found = structureFindings(entries);
  const settings = read('.claude/settings.json');
  if (settings) found.push(...hookFindings(settings.toString('utf8'), paths));
  found.push(...dependencyFindings(read('package.json')?.toString('utf8'), read('package-lock.json')?.toString('utf8')));
  const nvmrc = read('.nvmrc')?.toString('utf8') ?? '';
  if (!/^v?\d+\.\d+\.\d+\s*$/.test(nvmrc)) found.push(finding('nvmrc', '.nvmrc is missing or is not an exact x.y.z version', '.nvmrc'));
  for (const entry of entries) {
    if (entry.mode === '120000') continue;
    const bytes = read(entry.path);
    if (!bytes || bytes.length > MAX_TEXT_BYTES || bytes.subarray(0, 8000).includes(0)) continue;
    const text = bytes.toString('utf8');
    for (const needle of forbidden) if (needle && text.includes(needle)) found.push(finding('absolute-path', `contains the maintainer/scratch path ${needle}`, entry.path));
    if (LINE_ENDING_SENSITIVE.test(entry.path) && text.includes('\r')) found.push(finding('line-endings', 'carries CRLF line endings, which break shell scripts and shebangs', entry.path));
  }
  return found;
}
