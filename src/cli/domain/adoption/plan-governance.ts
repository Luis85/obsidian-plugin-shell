import type { AdoptionReport } from './contracts.ts';
import { designDirectory, documentationDirectory, generatedAppDirectory, kitDirectory, planPath, skillName } from './paths.ts';
import { baselineScripts, scriptCommand } from './plan-phases.ts';
import { bullets, code, numbered, plain, table } from './plan-markdown.ts';
import { stackOf, type Recommendation } from './strategy.ts';
import { kitCommand } from './paths.ts';

export function risks(report: AdoptionReport): string[][] {
  const flagged = report.findings.filter(item => item.severity !== 'info');
  const lines = flagged.map(item => `**${item.severity}** ${code(item.id)}: ${plain(item.message)}${item.evidence.length ? ` (${item.evidence.slice(0, 4).map(code).join(', ')})` : ''}`);
  return [['## 5. Conflicts and risks', '', 'From the compatibility findings:'], lines.length ? bullets(lines) : ['_No warnings or blockers were found._'],
    ['General risks:'], bullets([
      'Two toolchains: the kit needs its own Node version and the generated package pins its own dependencies; neither may leak into the legacy install.',
      'Generated source is developer-owned after creation. Regeneration refuses to overwrite hand-edited files, so edits and design changes must be reconciled deliberately.',
      'The Workbench CLI contract can change before a release; pin the kit you extracted and review each upgrade.',
      'Counts in the report are estimates from bounded source reading; confirm them before sizing work.',
      'Agent instructions can drift from the project: keep one authoritative file and let others point to it.'])];
}
export function untouched(report: AdoptionReport): string[][] {
  const kept = [`Legacy application source and assets${report.angular ? ' (including the Angular workspace configuration)' : ''}`, `${code('package.json')}, lockfiles and ${code('node_modules')}`,
    'TypeScript, lint, formatting and test configuration', 'Existing CI workflows (phase 5 adds a separate job only after approval)', `${code('.nvmrc')}, ${code('engines')} and other Node pins`,
    'Existing agent instruction files and settings (additions are merged by hand, never replaced)', 'Git configuration, hooks, remotes and credentials', 'Environment files and secrets'];
  return [['## 6. What stays untouched'], bullets(kept), [`Everything this plan adds is confined to ${[kitDirectory, designDirectory, documentationDirectory, generatedAppDirectory, '.claude/skills/' + skillName, '.agents/skills/' + skillName].map(code).join(', ')}, plus the two small edits named in phases 1 and 4.`]];
}
export function gates(report: AdoptionReport): string[][] {
  const legacy = baselineScripts(report).map(name => code(scriptCommand(report, name))).join(', ') || 'none detected';
  const rows = [
    ['Legacy baseline', legacy, 'The legacy project still builds and tests as before.', 'Anything about Workbench output.'],
    ['Kit integrity', code(`${kitCommand} framework status --root ${kitDirectory}`), 'Kit files match their recorded checksums.', 'Authenticity: checksums are not signatures.'],
    ['Design validity', code(`${kitCommand} compiler check --input design/project.json --root . --json`), 'The design parses and its references resolve; writes nothing.', 'That the design is right for users.'],
    ['Generated package', code(`cd ${generatedAppDirectory}/source && npm run typecheck && npm test && npm run build`), 'The generated package type-checks, passes its tests and builds.', 'Business acceptance or native/browser qualification.'],
    ['Change scope', code('git diff --stat main...HEAD'), 'Only the paths listed in section 6 changed.', 'Correctness of the changes.'],
  ];
  return [['## 7. Verification gates', '', 'Run the gates that exist for the phase just finished. A passing gate is evidence for that gate only; it does not qualify Workbench or authorize any release.'], table(['Gate', 'Command', 'Proves', 'Does not prove'], rows)];
}
export function rollback(): string[][] {
  return [['## 8. Rollback', '', 'Each phase is one commit on the adoption branch, so every step is reversible with Git. Nothing outside the listed paths is modified, and the kit is not imported by any legacy file.'],
    numbered([`Phase 4 or 5: ${code('git revert <commit>')} removes the route/flag edit or the CI job; delete ${code(generatedAppDirectory)} if the generated package is no longer wanted.`,
      `Phase 3: delete ${code(designDirectory)} and ${code(documentationDirectory + '/screens.request.json')}.`,
      `Phase 2: delete ${code('.claude/skills/' + skillName)} and ${code('.agents/skills/' + skillName)}; remove the appended Workbench section from the instruction files.`,
      `Phase 1: delete ${code(kitDirectory)} and the ignore-file lines that mention it.`,
      `Whole plan: ${code('git switch main && git branch -D workbench/adoption')} before merging, or ${code('git revert -m 1 <merge commit>')} after.`, `This plan file (${code(planPath)}) can stay as a record or be deleted.`])];
}
function stackQuestions(report: AdoptionReport, recommendation: Recommendation): string[] {
  const items: string[] = [];
  const stack = stackOf(report);
  if (recommendation.options[0]!.fit === 'not-advised' && stack === 'angular') items.push(`Is upgrading Angular (${code(report.angular?.version ?? 'unknown')} to ${code(report.targets.angular.version ?? 'the target')}) planned? It would make option A possible.`);
  if (stack === 'other-web') items.push('Workbench has no starter for the detected frontend: is a second Angular or vanilla app acceptable, or should the use stay design-only?');
  if (report.angular?.ssr) items.push('Server-side rendering is configured: must the generated screens be rendered on the server too?');
  if (report.angular?.stateManagement.length) items.push(`How should generated screens read the existing store (${report.angular.stateManagement.join(', ')})?`);
  return items;
}
function repositoryQuestions(report: AdoptionReport): string[] {
  const items: string[] = [];
  if (!report.target.git.present || report.target.git.dirty === true) items.push('Who commits or stashes the current changes before phase 0?');
  if (report.findings.some(item => item.id === 'NODE_MAJOR_DIFFERS' || item.id === 'NODE_ENGINES_EXCLUDE_TARGET')) items.push('How will developers and CI get Node 24 for the kit without changing the project\'s own Node?');
  if (report.agents.files.length) items.push(`Which of the existing agent files (${report.agents.files.slice(0, 4).map(code).join(', ')}) is authoritative?`);
  return items;
}
export function questions(report: AdoptionReport, recommendation: Recommendation): string[][] {
  const items = [`Do you accept strategy ${recommendation.primary} (section 3), or should another option be evaluated first?`,
    `Should ${code(kitDirectory)} be committed (reproducible, larger repository) or fetched in CI from a pinned release?`,
    `Is ${code(generatedAppDirectory)} the right location${report.tooling.monorepo.includes('nx') ? ', and should it join the Nx project graph' : ''}?`,
    'Which screens come first, and who accepts them from a business point of view?', 'Which feature-flag mechanism does the project already use?',
    ...stackQuestions(report, recommendation), ...repositoryQuestions(report)];
  return [['## 9. Open questions for the owner'], numbered(items)];
}
