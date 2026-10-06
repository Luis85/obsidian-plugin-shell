/**
 * The kick-off PullRequest document and the optional Issue document `increment.mjs new --kickoff [--issue]`
 * writes next to a new Increment, and the Increment frontmatter that links them (branch, base, pullRequests,
 * issues). Pure text; the Increments CLI (`node bin/app increment new`) is the main authoring path.
 */
import { branchName } from '../../src/cli/tooling/delivery/documents.mjs';
import { setFrontmatterValue } from '../../src/cli/tooling/delivery/generate.mjs';

const quote = value => `"${String(value).replace(/["\\]/g, '\\$&')}"`;
const link = path => path.replace(/\.md$/, '');

function kickoffText(delivery, { slug, title, incrementPath, id, branch }) {
  return ['---', `type: ${delivery.pullRequests.type}`, `id: ${id}`, `title: ${quote(`Kick-off: ${title}`)}`, `${delivery.pullRequests.incrementKey}: ${slug}`, 'status: New', 'kind: kickoff',
    `base: ${delivery.branches.base}`, `head: ${quote(branch)}`, '---', '', `# Kick-off: ${title}`, '',
    '## Summary', '', `Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges \`${branch}\` into \`${delivery.branches.base}\`.`, '',
    '## Scope', '', '### In scope', '', `- The Increment document [[${link(incrementPath)}]], its acceptance test stubs and their refinement.`, '',
    '### Out of scope', '', `- Implementation: it lands through change pull requests into \`${branch}\`.`, '',
    '## Tasks', '', '- [ ] T-1: Refine the increment until the Definition of Ready passes.', '- [ ] T-2: Generate the acceptance test stubs with `npm run dor -- --write`.', '',
    '## Documents', '', `- [[${link(incrementPath)}|Increment: ${title}]]`, ''].join('\n');
}
function issueText(delivery, { slug, title, incrementPath }) {
  return ['---', `type: ${delivery.issues.type}`, `id: ${slug}`, `title: ${quote(title)}`, 'status: New', `${delivery.issues.incrementKey}: ${slug}`, '---', '', `# ${title}`, '',
    '## Summary', '', `Tracks [[${link(incrementPath)}|${title}]].`, '', '## Acceptance criteria', '', 'The acceptance criteria of the increment.', '', '## Notes', '', 'None.', ''].join('\n');
}

/** { files: { path: text }, incrementText } for a new Increment with its kick-off (and issue) documents. */
export function kickoffDocuments(delivery, { slug, title, incrementPath, incrementText, issue = false }) {
  const branch = branchName(delivery.branches.increment, { id: slug }); const id = `${slug}-kickoff`;
  const files = { [delivery.pullRequests.glob.replace('*', id)]: kickoffText(delivery, { slug, title, incrementPath, id, branch }) };
  let text = setFrontmatterValue(incrementText, 'pullRequests', `[${id}]`);
  if (issue) { files[delivery.issues.glob.replace('*', slug)] = issueText(delivery, { slug, title, incrementPath }); text = setFrontmatterValue(text, 'issues', `[${slug}]`); }
  text = setFrontmatterValue(setFrontmatterValue(text, 'branch', quote(branch)), 'base', delivery.branches.base);
  return { files, incrementText: text };
}
