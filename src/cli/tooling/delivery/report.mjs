/**
 * Report views over one result object: the terminal text, the versioned JSON document and the Markdown
 * job summary (also the refinement brief written next to it). Every failing rule carries its fix hint.
 */
const labels = { ready: 'Definition of Ready', done: 'Definition of Done' };
const marks = { pass: 'pass', fail: 'FAIL', warn: 'warn', skip: 'skip', disabled: 'off ' };
const failing = result => result.rules.filter(rule => rule.status === 'fail' || rule.status === 'warn');

/** The versioned machine document (protocolVersion 1). */
export function jsonReport(result) {
  return { protocolVersion: 1, gate: result.gate, status: result.status, handoff: result.handoff ?? null, base: result.base ?? null, scope: result.scope ?? null,
    notices: result.notices ?? [], rules: result.rules.map(rule => ({ id: rule.id, title: rule.title, severity: rule.severity, status: rule.status,
      message: rule.message, hint: rule.hint ?? null, ...(rule.details ? { details: rule.details } : {}) })),
    ...(result.refinement ? { refinement: result.refinement } : {}), generated: result.generated ?? {}, ...(result.error ? { error: result.error } : {}) };
}

/** Questions per failed rule plus the skills that run a refinement session. */
export function refinementBrief(result, definitions, delivery) {
  const failed = result.rules.filter(rule => rule.status === 'fail' && rule.severity === 'error');
  if (!failed.length) return null;
  return { skills: delivery.refinement.skills, newHandoff: delivery.refinement.newHandoff,
    questions: failed.map(rule => ({ rule: rule.id, title: rule.title, questions: definitions[rule.id]?.questions ?? [] })) };
}

function briefMarkdown(brief, handoff) {
  const [first, ...rest] = brief.skills;
  return ['### Refinement brief', '',
    `This increment is not ready to implement. Start a refinement session before writing code: use the \`${first}\` skill to complete ${handoff ? `\`${handoff}\`` : `a handoff (\`${brief.newHandoff}\`)`}, and the ${rest.map(skill => `\`${skill}\``).join(' or ')} skills when the problem or the solution itself is still open.`, '',
    'Questions to answer:', '',
    ...brief.questions.flatMap(item => [`- **${item.rule} ${item.title}**`, ...item.questions.map(question => `  - ${question}`)]), ''];
}

const kindLabels = { change: 'change pull request', kickoff: 'kick-off pull request' };
/** "change pull request docs/pull-requests/x.md" for a change or kick-off, else null. */
const scopeText = scope => (kindLabels[scope?.kind] ? `${kindLabels[scope.kind]}${scope.pullRequest ? ` ${scope.pullRequest}` : ''}` : null);
const stubLines = generated => [...(generated?.stubs ?? []).map(path => `stub ${path}`), ...(generated?.orphans ?? []).map(path => `orphan stub ${path} (no matching criterion)`)];

/** Terminal text. */
export function humanReport(result) {
  const where = [result.handoff, scopeText(result.scope), result.base && `base ${result.base.ref} ${result.base.sha.slice(0, 12)}`].filter(Boolean).join(', ');
  const lines = [`${labels[result.gate]}: ${result.status.toUpperCase()}${where ? ` (${where})` : ''}`];
  for (const notice of result.notices ?? []) lines.push(`  notice: ${notice}`);
  if (result.error) lines.push(`  error: ${result.error}`);
  for (const rule of result.rules) {
    lines.push(`  ${marks[rule.status]}  ${rule.id} ${rule.title}: ${rule.message}`);
    if (rule.status === 'fail' || rule.status === 'warn') {
      if (rule.hint) lines.push(`        fix: ${rule.hint}`);
      for (const detail of rule.details ?? []) lines.push(`        - ${detail}`);
    }
  }
  if (result.refinement) {
    lines.push('', `Refinement needed: run the ${result.refinement.skills.map(skill => `\`${skill}\``).join(', ')} skill(s); questions:`);
    for (const item of result.refinement.questions) for (const question of item.questions) lines.push(`  ${item.rule}: ${question}`);
  }
  if (!result.generated?.written?.length) for (const line of stubLines(result.generated)) lines.push(`  ${line}${line.startsWith('stub') ? ' (create it with --write)' : ''}`);
  for (const path of result.generated?.written ?? []) lines.push(`  wrote ${path}`);
  for (const path of result.generated?.out ?? []) lines.push(`  generated ${path}${result.gate === 'done' ? ' (apply locally with --write)' : ''}`);
  return lines.join('\n');
}

/** Markdown for $GITHUB_STEP_SUMMARY. */
export function summaryMarkdown(result) {
  const out = [`## ${labels[result.gate]}: ${result.status}`, ''];
  out.push([result.handoff ? `Handoff: \`${result.handoff}\`` : 'Handoff: none', scopeText(result.scope), result.base ? `base \`${result.base.ref}\` (\`${result.base.sha.slice(0, 12)}\`)` : null].filter(Boolean).join(' · '), '');
  for (const notice of result.notices ?? []) out.push(`> ${notice}`, '');
  if (result.error) out.push(`> Error: ${result.error}`, '');
  if (result.rules.length) {
    out.push('| Rule | Severity | Result | Message |', '| --- | --- | --- | --- |');
    for (const rule of result.rules) out.push(`| ${rule.id} ${rule.title} | ${rule.severity} | ${rule.status} | ${rule.message.replace(/\|/g, '\\|')} |`);
    out.push('');
  }
  const fixes = failing(result);
  if (fixes.length) {
    out.push('### How to fix', '');
    for (const rule of fixes) out.push(`- **${rule.id}** (${rule.status}): ${rule.hint ?? rule.message}`, ...(rule.details ?? []).slice(0, 10).map(detail => `  - ${detail}`));
    out.push('');
  }
  if (result.refinement) out.push(...briefMarkdown(result.refinement, result.handoff));
  const stubs = stubLines(result.generated);
  if (stubs.length) out.push('### Acceptance stubs', '', ...stubs.map(line => `- ${line}`), '', 'Create the missing stubs with `npm run dor -- --write`; the job artifact holds them.', '');
  const generated = result.generated ?? {};
  if (generated.completionRecord) {
    out.push('### Generated documentation', '', `Apply it locally with \`npm run ${result.gate === 'done' ? 'dod' : 'dor'} -- --write${result.base ? ` --base ${result.base.ref}` : ''}\`${generated.out?.length ? '; the job artifact holds the generated files' : ''}.`, '');
    if (generated.changelog?.length) out.push('Changelog entries for `## [Unreleased]`:', '', ...generated.changelog.map(entry => `- ${entry.category}: ${entry.text}`), '');
    if (generated.docsIndex?.length) out.push(`Index rows for \`docs/README.md\`: ${generated.docsIndex.map(path => `\`${path}\``).join(', ')}`, '');
    out.push('<details><summary>Completion record</summary>', '', '```markdown', generated.completionRecord.trimEnd(), '```', '', '</details>', '');
  }
  return out.join('\n');
}

/** The refinement brief as a standalone Markdown file for the job artifact. */
export function refinementMarkdown(result) {
  return [`# Refinement brief${result.handoff ? `: ${result.handoff}` : ''}`, '', ...briefMarkdown(result.refinement, result.handoff).slice(2),
    '## Failing rules', '', ...failing(result).map(rule => `- **${rule.id} ${rule.title}**: ${rule.message} Fix: ${rule.hint ?? ''}`), ''].join('\n');
}
