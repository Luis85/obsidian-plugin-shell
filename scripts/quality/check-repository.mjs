import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

export function inspectWorkflow(text) {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length) throw new Error('WORKFLOW_YAML_INVALID');
  const data = document.toJS();
  if (!data || typeof data !== 'object' || !data.name || !data.on || !data.jobs || typeof data.jobs !== 'object' || Array.isArray(data.jobs)) throw new Error('WORKFLOW_SHAPE_INVALID');
  const permissions = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => !['read', 'none'].includes(item))) throw new Error('WORKFLOW_PERMISSIONS_NOT_READ_ONLY');
  };
  permissions(data.permissions);
  if (data.on === 'pull_request_target' || (Array.isArray(data.on) && data.on.includes('pull_request_target')) || (typeof data.on === 'object' && Object.hasOwn(data.on, 'pull_request_target'))) throw new Error('PRIVILEGED_PR_TRIGGER_FORBIDDEN');
  const pinned = value => {
    if (typeof value !== 'string' || !/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(value)) throw new Error('WORKFLOW_ACTION_NOT_PINNED');
  };
  const jobs = Object.values(data.jobs);
  if (!jobs.length) throw new Error('WORKFLOW_NO_JOBS');
  for (const job of jobs) {
    if (!job || typeof job !== 'object') throw new Error('WORKFLOW_JOB_INVALID');
    if (job.permissions) permissions(job.permissions);
    if (job.uses) { pinned(job.uses); continue; }
    if (!job['runs-on'] || !Array.isArray(job.steps) || !job.steps.length) throw new Error('WORKFLOW_JOB_INVALID');
    for (const step of job.steps) {
      if (!step || typeof step !== 'object' || Boolean(step.uses) === Boolean(step.run)) throw new Error('WORKFLOW_STEP_INVALID');
      if (step.uses) {
        pinned(step.uses);
        if (step.uses.startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) throw new Error('WORKFLOW_PERSISTED_CREDENTIALS');
      }
      if (step.run && /\$\{\{\s*(?:github\.event\.(?:pull_request|issue|comment)|inputs\.)/.test(step.run)) throw new Error('WORKFLOW_UNTRUSTED_SHELL_INTERPOLATION');
    }
  }
  return { jobs: jobs.length };
}
/** Owned styles only. Full compiled containment remains the artifact gate's job. */
export function inspectOwnedCss(text, name = 'owned.css') {
  const ast = postcss.parse(text, { from: name }); let declarations = 0;
  ast.walkDecls(declaration => {
    declarations++;
    if (!declaration.value.trim()) throw new Error('CSS_EMPTY_DECLARATION');
  });
  ast.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    selectorParser(selectors => {
      selectors.each(selector => {
        let owned = false;
        selector.walk(node => { if (node.type === 'class' || (node.type === 'attribute' && node.attribute === 'data-plugin-ui')) owned = true; });
        if (!owned) throw new Error('CSS_UNOWNED_SELECTOR');
      });
    }).processSync(rule.selector);
  });
  return { declarations };
}
export function markdownLinks(text) {
  // Narrow policy: balanced fenced blocks and existing inline local file links.
  // Reference links, anchors, spelling and full Markdown grammar are not claimed.
  const lines = []; let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (match && !fence) { fence = match[1]; continue; }
    if (match && fence && match[1][0] === fence[0] && match[1].length >= fence.length) { fence = null; continue; }
    if (!fence) lines.push(line.replace(/`[^`]*`/g, ''));
  }
  if (fence) throw new Error('MARKDOWN_UNCLOSED_FENCE');
  const links = [];
  for (const match of lines.join('\n').matchAll(/!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
    const value = match[1] ?? match[2];
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(value)) continue;
    const path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    if (path) links.push(path);
  }
  return links;
}
export async function checkRepository(root = process.cwd()) {
  root = resolve(root); const files = [];
  async function walk(folder, pattern) {
    for (const entry of await readdir(resolve(root, folder), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('REPOSITORY_INPUT_SYMLINK');
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await walk(path, pattern);
      else if (pattern.test(entry.name)) files.push(path);
    }
  }
  await walk('.github/workflows', /\.ya?ml$/); await walk('src/styles', /\.css$/); await walk('docs', /\.md$/);
  for (const name of ['README.md', 'AGENTS.md', 'CHANGELOG.md']) { try { await access(join(root, name)); files.push(name); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const counts = { workflows: 0, styles: 0, markdown: 0, localLinks: 0 }; const failures = [];
  for (const file of files) {
    try {
      const text = await readFile(join(root, file), 'utf8');
      if (/\.ya?ml$/.test(file)) { inspectWorkflow(text); counts.workflows++; }
      else if (file.endsWith('.css')) { inspectOwnedCss(text, file); counts.styles++; }
      else {
        for (const link of markdownLinks(text)) {
          const destination = resolve(dirname(join(root, file)), link);
          const local = relative(root, destination);
          if (local === '..' || local.startsWith('..' + sep)) throw new Error(`MARKDOWN_LINK_OUTSIDE_REPOSITORY: ${link}`);
          try { await access(destination); } catch { throw new Error(`MARKDOWN_MISSING_LOCAL_LINK: ${link}`); }
          counts.localLinks++;
        }
        counts.markdown++;
      }
    } catch (error) { failures.push(`${file}: ${error.message}`); }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  if (!counts.workflows || !counts.styles || !counts.markdown) throw new Error('REPOSITORY_INPUTS_MISSING');
  return { status: 'passed', ...counts, scope: 'read-only workflow subset, owned CSS syntax/selectors, Markdown fences/local inline file links' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 2) throw new Error('NO_ARGUMENTS_SUPPORTED'); console.log(JSON.stringify(await checkRepository())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
