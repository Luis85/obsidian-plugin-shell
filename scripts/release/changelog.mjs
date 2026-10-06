/**
 * Keep a Changelog 1.1.0 parsing, validation, note extraction and Unreleased promotion.
 *
 *   node scripts/release/changelog.mjs check [--file CHANGELOG.md] [--json]
 *   node scripts/release/changelog.mjs notes --version X.Y.Z [--file CHANGELOG.md] [--out notes.md]
 *
 * `check` exits 1 with coded diagnostics. `notes` prints (or writes, never overwriting) one version's
 * section body: the text a release candidate and the GitHub release use as notes. The functions are
 * pure; release preparation (prepare.mjs) owns the file write through the hash-checked file plan.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const categories = Object.freeze(['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']);
export const changelogIntro = 'All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release tags are bare versions such as `1.2.3` (the Obsidian convention).';
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const versionHeading = /^## \[([^\]]+)\] - (\S+)$/;
const linkDefinition = /^\[([^\]\n]+)\]:\s*(\S+)\s*$/;
const repositoryBase = /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const fence = /^\s{0,3}(`{3,}|~{3,})/;

const diagnostic = (code, line, message) => ({ code, line, message });
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function compareStable(a, b) {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return Math.sign(left[index] - right[index]);
  return 0;
}
function trimBlank(lines) {
  let start = 0, end = lines.length;
  while (start < end && !lines[start].trim()) start++;
  while (end > start && !lines[end - 1].trim()) end--;
  return lines.slice(start, end);
}

/** Line-based model. Headings inside fenced code are content; link definitions are the trailing block. */
export function parseChangelog(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end--;
  let linkStart = end;
  while (linkStart > 0 && (linkDefinition.test(lines[linkStart - 1]) || !lines[linkStart - 1].trim())) linkStart--;
  while (linkStart < end && !lines[linkStart].trim()) linkStart++;
  const links = [];
  for (let index = linkStart; index < end; index++) {
    const match = linkDefinition.exec(lines[index]);
    if (match) links.push({ label: match[1], url: match[2], line: index + 1 });
  }
  const headings = []; let open = null;
  for (let index = 0; index < linkStart; index++) {
    const marker = fence.exec(lines[index]);
    if (marker) {
      if (!open) open = marker[1];
      else if (marker[1][0] === open[0] && marker[1].length >= open.length) open = null;
      continue;
    }
    const heading = !open && /^(#{1,6})\s+(.*)$/.exec(lines[index]);
    if (heading) headings.push({ level: heading[1].length, text: lines[index], line: index + 1, index });
  }
  const sections = [];
  for (const heading of headings.filter(item => item.level === 2)) {
    const match = versionHeading.exec(heading.text);
    sections.push({ heading: heading.text, line: heading.line, start: heading.index,
      unreleased: heading.text === '## [Unreleased]', version: match?.[1] ?? null, date: match?.[2] ?? null });
  }
  sections.forEach((section, index) => { section.end = sections[index + 1]?.start ?? linkStart; });
  return { lines, headings, sections, links, linkStart, unclosedFence: Boolean(open) };
}

function sectionLines(model, section) { return trimBlank(model.lines.slice(section.start + 1, section.end)); }
export function sectionBody(model, section) { return sectionLines(model, section).join('\n'); }

function linkDiagnostics(model, versions, requireLinks) {
  const found = []; const byLabel = new Map();
  for (const link of model.links) {
    if (byLabel.has(link.label)) found.push(diagnostic('CHANGELOG_LINK_DUPLICATE', link.line, `Link reference [${link.label}] is defined more than once.`));
    byLabel.set(link.label, link);
  }
  const known = new Set(versions.map(section => section.version));
  for (const link of model.links) {
    if (stable.test(link.label) && !known.has(link.label)) found.push(diagnostic('CHANGELOG_LINK_UNKNOWN', link.line, `Link reference [${link.label}] has no version section.`));
  }
  const unreleased = byLabel.get('Unreleased');
  if (!requireLinks && !model.links.length) return { found, base: null };
  if (!unreleased) { found.push(diagnostic('CHANGELOG_LINK_MISSING', model.linkStart + 1, 'Add an [Unreleased] link reference.')); return { found, base: null }; }
  const latest = versions[0]?.version;
  const match = /^(.*)\/compare\/([^/]+)\.\.\.HEAD$/.exec(unreleased.url) ?? /^(.*)\/commits\/HEAD$/.exec(unreleased.url);
  const base = match && repositoryBase.test(match[1]) ? match[1] : null;
  if (!base || (latest ? match[2] !== latest : match[2] !== undefined))
    found.push(diagnostic('CHANGELOG_LINK_INCONSISTENT', unreleased.line, latest ? `[Unreleased] must be https://github.com/<owner>/<repo>/compare/${latest}...HEAD.` : '[Unreleased] must be https://github.com/<owner>/<repo>/commits/HEAD before the first release.'));
  versions.forEach((section, index) => {
    const link = byLabel.get(section.version);
    if (!link) { found.push(diagnostic('CHANGELOG_LINK_MISSING', section.line, `Add a [${section.version}] link reference.`)); return; }
    const previous = versions[index + 1]?.version;
    const accepted = base ? [`${base}/releases/tag/${section.version}`, ...(previous ? [`${base}/compare/${previous}...${section.version}`] : [])] : [];
    if (base && !accepted.includes(link.url)) found.push(diagnostic('CHANGELOG_LINK_INCONSISTENT', link.line, `[${section.version}] must be ${accepted.join(' or ')}.`));
  });
  return { found, base };
}

/** Structure diagnostics; requireLinks=false only tolerates a changelog with no link references at all. */
export function validateChangelog(text, { requireLinks = true } = {}) {
  const model = parseChangelog(text); const found = [];
  const firstContent = model.lines.findIndex(line => line.trim());
  if (model.lines[firstContent] !== '# Changelog') found.push(diagnostic('CHANGELOG_TITLE_REQUIRED', firstContent + 1, 'The first line must be "# Changelog".'));
  if (model.unclosedFence) found.push(diagnostic('CHANGELOG_UNCLOSED_FENCE', model.linkStart, 'Close every fenced code block.'));
  for (const heading of model.headings) {
    if (heading.level === 1 && heading.index !== firstContent) found.push(diagnostic('CHANGELOG_TITLE_DUPLICATE', heading.line, 'Only one level-one heading is allowed.'));
    if (heading.level === 3 && (!model.sections.length || heading.index < model.sections[0].start)) found.push(diagnostic('CHANGELOG_CATEGORY_OUTSIDE_SECTION', heading.line, 'Category headings belong inside a version section.'));
  }
  const unreleased = model.sections.filter(section => section.unreleased);
  if (!unreleased.length) found.push(diagnostic('CHANGELOG_UNRELEASED_REQUIRED', 1, 'Add a "## [Unreleased]" section.'));
  else if (!model.sections[0].unreleased || unreleased.length > 1) found.push(diagnostic('CHANGELOG_UNRELEASED_NOT_FIRST', unreleased.at(-1).line, '"## [Unreleased]" must be the single first section.'));
  const versions = []; const seen = new Set();
  for (const section of model.sections) {
    if (section.unreleased) continue;
    if (!section.version || !stable.test(section.version)) { found.push(diagnostic('CHANGELOG_VERSION_HEADER_INVALID', section.line, 'Use "## [X.Y.Z] - YYYY-MM-DD" with a stable version.')); continue; }
    if (!validDate(section.date)) found.push(diagnostic('CHANGELOG_DATE_INVALID', section.line, `${section.version} needs a real YYYY-MM-DD date.`));
    if (seen.has(section.version)) { found.push(diagnostic('CHANGELOG_VERSION_DUPLICATE', section.line, `${section.version} appears more than once.`)); continue; }
    const previous = versions.at(-1);
    if (previous && compareStable(previous.version, section.version) <= 0) found.push(diagnostic('CHANGELOG_VERSION_ORDER', section.line, `${section.version} must be lower than ${previous.version} above it.`));
    else if (previous && validDate(previous.date) && validDate(section.date) && previous.date < section.date) found.push(diagnostic('CHANGELOG_DATE_ORDER', section.line, `${section.version} is dated after the newer ${previous.version}.`));
    if (!sectionBody(model, section)) found.push(diagnostic('CHANGELOG_VERSION_EMPTY', section.line, `${section.version} has no content.`));
    seen.add(section.version); versions.push(section);
  }
  for (const section of model.sections) {
    const names = new Set();
    for (const heading of model.headings.filter(item => item.level === 3 && item.index > section.start && item.index < section.end)) {
      const name = heading.text.replace(/^###\s+/, '').trim();
      if (!categories.includes(name)) found.push(diagnostic('CHANGELOG_CATEGORY_INVALID', heading.line, `Use one of ${categories.join(', ')}.`));
      else if (names.has(name)) found.push(diagnostic('CHANGELOG_CATEGORY_DUPLICATE', heading.line, `${name} appears twice in one section.`));
      names.add(name);
    }
  }
  const links = linkDiagnostics(model, versions, requireLinks);
  found.push(...links.found);
  return { ok: !found.length, diagnostics: found.sort((a, b) => a.line - b.line), model, versions, base: links.base };
}

const invalid = result => Object.assign(new Error(`CHANGELOG_INVALID: ${[...new Set(result.diagnostics.map(item => item.code))].join(', ')}`), { diagnostics: result.diagnostics });

/** One released version's non-empty section body from a valid changelog. */
export function extractNotes(text, version) {
  const result = validateChangelog(text);
  if (!result.ok) throw invalid(result);
  const section = result.versions.find(item => item.version === version);
  if (!section) throw new Error(`CHANGELOG_VERSION_MISSING: ${version}`);
  return sectionBody(result.model, section);
}

function splitCategories(body) {
  const preface = []; const groups = new Map(); let current = preface; let open = null;
  for (const line of body.split('\n')) {
    const marker = fence.exec(line);
    if (marker) open = !open ? marker[1] : (marker[1][0] === open[0] && marker[1].length >= open.length ? null : open);
    const heading = !open && !marker && /^###\s+(.+)$/.exec(line);
    if (heading) { current = groups.get(heading[1].trim()) ?? []; groups.set(heading[1].trim(), current); } else current.push(line);
  }
  return { preface: trimBlank(preface), groups };
}
/** Appends reviewed notes to Unreleased content, merging items under matching category headings. */
export function mergeNotes(existing, notes) {
  const left = String(existing ?? '').trim(), right = String(notes ?? '').replace(/\r\n?/g, '\n').trim();
  if (!left || !right) return left || right;
  const a = splitCategories(left), b = splitCategories(right);
  const preface = [a.preface.join('\n'), b.preface.join('\n')].filter(Boolean).join('\n\n');
  const names = [...a.groups.keys(), ...[...b.groups.keys()].filter(name => !a.groups.has(name))];
  const parts = names.map(name => [`### ${name}`, '', ...trimBlank([...trimBlank(a.groups.get(name) ?? []), ...trimBlank(b.groups.get(name) ?? [])])].join('\n'));
  return [preface, ...parts].filter(Boolean).join('\n\n');
}

/** The GitHub base URL from package.json "repository" (string, github: shorthand or { url }). */
export function repositoryUrl(pkg) {
  const raw = typeof pkg?.repository === 'string' ? pkg.repository : pkg?.repository?.url;
  if (typeof raw !== 'string') return null;
  const match = /^(?:github:|git\+https:\/\/github\.com\/|https:\/\/github\.com\/|git@github\.com:)?([A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*?)(?:\.git)?\/?$/.exec(raw.trim());
  return match && !/^[a-z+]+:/.test(match[1]) ? `https://github.com/${match[1]}` : null;
}
function linkBlock(base, versions, existing) {
  if (!base) return [];
  const byLabel = new Map(existing.map(link => [link.label, link.url]));
  const rows = [`[Unreleased]: ${base}/${versions.length ? `compare/${versions[0]}...HEAD` : 'commits/HEAD'}`];
  for (const version of versions) rows.push(`[${version}]: ${byLabel.get(version) ?? `${base}/releases/tag/${version}`}`);
  const custom = existing.filter(link => link.label !== 'Unreleased' && !versions.includes(link.label));
  return [...rows, ...custom.map(link => `[${link.label}]: ${link.url}`)];
}

/**
 * Moves Unreleased (merged with optional notes) into "## [version] - date", leaves an empty Unreleased and
 * rewrites link references. A missing changelog starts a new one. Links need a known GitHub base.
 */
export function promoteUnreleased(text, { version, date, notes, repository = null }) {
  if (!stable.test(version ?? '')) throw new Error('INVALID_STABLE_VERSION');
  if (!validDate(date)) throw new Error('RELEASE_DATE_INVALID');
  const source = text ?? `# Changelog\n\n${changelogIntro}\n\n## [Unreleased]\n`;
  const lenient = parseChangelog(source).links.length === 0;
  const result = validateChangelog(source, { requireLinks: !lenient });
  if (!result.ok) throw invalid(result);
  if (result.versions.some(section => section.version === version)) throw new Error('CHANGELOG_VERSION_EXISTS');
  if (result.versions[0] && compareStable(version, result.versions[0].version) <= 0) throw new Error('VERSION_NOT_NEW');
  const { model } = result; const unreleased = model.sections[0];
  const body = mergeNotes(sectionBody(model, unreleased), notes);
  if (!body) throw new Error('RELEASE_NOTES_EMPTY: Unreleased has no entries and no --notes-file was given.');
  const base = result.base ?? (repository && repositoryBase.test(repository) ? repository : null);
  const versions = [version, ...result.versions.map(section => section.version)];
  const head = trimBlank(model.lines.slice(0, unreleased.start));
  const rest = trimBlank(model.lines.slice(unreleased.end, model.linkStart));
  const links = linkBlock(base, versions, model.links);
  const output = [...head, '', '## [Unreleased]', '', `## [${version}] - ${date}`, '', body, ...(rest.length ? ['', ...rest] : []), ...(links.length ? ['', ...links] : [])].join('\n') + '\n';
  const check = validateChangelog(output, { requireLinks: Boolean(base) });
  if (!check.ok) throw invalid(check);
  return { text: output, section: body, linkReferences: base ? 'updated' : 'not-configured' };
}

export function parseChangelogArguments(args) {
  const [command, ...rest] = args; const options = { command, file: 'CHANGELOG.md' }; const seen = new Set();
  if (!command || command === '--help') return { help: true };
  if (!['check', 'notes'].includes(command)) throw new Error(`UNKNOWN_COMMAND: ${command}`);
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`);
    seen.add(flag);
    if (flag === '--json') options.json = true;
    else if (['--file', '--version', '--out'].includes(flag)) {
      const value = rest[++index];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[flag.slice(2)] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  if (command === 'notes' && !stable.test(options.version ?? '')) throw new Error('VERSION_REQUIRED: notes needs --version X.Y.Z');
  if (command === 'check' && (options.version || options.out)) throw new Error('UNKNOWN_ARGUMENT: check accepts --file and --json');
  return options;
}

const usage = `node scripts/release/changelog.mjs check [--file CHANGELOG.md] [--json]
node scripts/release/changelog.mjs notes --version X.Y.Z [--file CHANGELOG.md] [--out notes.md]
Validates Keep a Changelog 1.1.0 structure or prints one version's notes. Never overwrites --out.`;
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseChangelogArguments(process.argv.slice(2));
    if (options.help) console.log(usage);
    else {
      const text = await readFile(resolve(options.file), 'utf8');
      if (options.command === 'check') {
        const result = validateChangelog(text);
        const summary = { status: result.ok ? 'passed' : 'failed', file: options.file, versions: result.versions.map(section => section.version), diagnostics: result.diagnostics };
        if (options.json) console.log(JSON.stringify(summary, null, 2));
        else if (result.ok) console.log(`Changelog check passed: ${options.file} (${summary.versions.length} versions, Keep a Changelog 1.1.0).`);
        else for (const item of result.diagnostics) console.error(`${options.file}:${item.line}: ${item.code}: ${item.message}`);
        if (!result.ok) process.exitCode = 1;
      } else {
        const notes = extractNotes(text, options.version) + '\n';
        if (options.out) await writeFile(resolve(options.out), notes, { flag: 'wx' });
        else process.stdout.write(notes);
      }
    }
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'OUTPUT_EXISTS: --out never overwrites an existing file.' : error.message);
    for (const item of error.diagnostics ?? []) console.error(`  line ${item.line}: ${item.code}: ${item.message}`);
    process.exitCode = 1;
  }
}
