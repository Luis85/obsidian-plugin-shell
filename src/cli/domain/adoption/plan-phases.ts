import type { AdoptionReport } from './contracts.ts';
import { designFile, documentationDirectory, kitCommand, kitDirectory, skillName, skillRoots } from './paths.ts';
import { bullets, code, fence, list, plain } from './plan-markdown.ts';

export interface PhaseParts { goal: string; commands: string; files: string[]; acceptance: string[]; notes?: string[]; extra?: string[][] }
export function phase(number: number, title: string, parts: PhaseParts): string[][] {
  return [[`### Phase ${number}: ${title}`, '', `**Goal.** ${parts.goal}`], ...(parts.notes?.length ? [bullets(parts.notes)] : []), ['**Commands**', '', ...fence(parts.commands)], ...(parts.extra ?? []),
    ['**Files to add or change**', '', ...bullets(parts.files)], ['**Acceptance checks**', '', ...bullets(parts.acceptance)]];
}
/** The project's own script invocation, never executed by Workbench. */
export function scriptCommand(report: AdoptionReport, script: string): string {
  const manager = report.runtime.packageManager.name;
  if (manager === 'yarn') return `yarn ${script}`;
  if (manager === 'pnpm') return `pnpm run ${script}`;
  return manager === 'bun' ? `bun run ${script}` : `npm run ${script}`;
}
export function baselineScripts(report: AdoptionReport): string[] {
  return ['lint', 'typecheck', 'type-check', 'test', 'build', 'e2e'].filter(name => report.runtime.scripts.includes(name));
}
function ignoreFiles(report: AdoptionReport): string[] {
  const entries: string[] = [];
  if (report.tooling.lint.includes('eslint')) entries.push(`ESLint ignores: add ${code(kitDirectory + '/**')} to the ignore patterns of your ESLint configuration`);
  if (report.tooling.format.includes('prettier')) entries.push(`${code('.prettierignore')}: add ${code(kitDirectory + '/')}`);
  entries.push(`${code('tsconfig*.json')}: confirm ${code(kitDirectory)} is outside every ${code('include')} pattern (add it to ${code('exclude')} if a pattern is broad)`);
  return entries;
}
export function phaseZero(report: AdoptionReport): string[][] {
  const scripts = baselineScripts(report).map(name => scriptCommand(report, name));
  const git = report.target.git.present ? `git status --short   # must print nothing\ngit switch -c workbench/adoption` : 'git init   # no repository exists: initialise one and commit the current state first\n# review .gitignore first: the next command stages everything that is not ignored\ngit add -A && git commit -m "chore: baseline before Workbench adoption"\ngit switch -c workbench/adoption';
  const baseline = scripts.length ? scripts.map(command => `${command}   # runs the project's own script; read it in package.json first`).join('\n') : '# No lint/test/build scripts were found in package.json; record how this project is built and tested by hand.';
  return phase(0, 'Prerequisites and toolchain', {
    goal: 'Start from a clean, recorded baseline and a Node toolchain for the kit that does not disturb the project.',
    commands: `${git}\n${baseline}\nnode --version   # the kit needs ${report.targets.node.version ?? 'the version in its .nvmrc'}; use a separate shell or version manager, never edit the project's pin`,
    files: ['None. This phase only reads and records results (put the baseline output in the pull request description).'],
    acceptance: ['The working tree was clean before the branch was created.', `The baseline commands above ran once and their results are written down${scripts.length ? '' : ' manually'}.`, 'Node for the kit is available without changing .nvmrc, engines or CI images of the project.'],
    notes: report.target.git.dirty === true ? ['The analysis found uncommitted changes: commit or stash them before the branch is created.'] : [],
  });
}
function kitNotes(report: AdoptionReport): string[] {
  const kitPath = report.workbench.kitPath;
  const notes = ['No release is published yet. Until one exists, build a kit from a Workbench checkout with `node bin/app framework pack --out ./workbench-cli.zip --yes`; the result is a local candidate, not a released or qualified artifact.'];
  if (kitPath === null) return notes;
  return [`The CLI kit is already extracted at ${code(kitPath)}; skip the download and run only the verification commands.${kitPath === kitDirectory || kitPath === '.' ? '' : ` Every command in this plan uses ${code(kitDirectory)}: substitute your path.`}`, ...notes];
}
export function phaseOne(report: AdoptionReport): string[][] {
  return phase(1, 'Install the CLI kit as a sidecar', {
    goal: `Make the Workbench CLI available inside the project, from the project root, without installing anything into its dependency graph.`,
    commands: `mkdir -p ${kitDirectory}\n# Download workbench-cli-<version>.zip and workbench-SHA256SUMS from the Workbench release, then:\nsha256sum -c workbench-SHA256SUMS --ignore-missing\nunzip workbench-cli-<version>.zip -d ${kitDirectory}\n# Optional: workbench-starters-<version>.zip into the same folder, for configs/starters\nls ${kitDirectory}/bin/app   # bin/app must sit directly in the kit folder, not in a nested folder\n${kitCommand} framework status --root ${kitDirectory}\n${kitCommand} help`,
    files: [`${code(kitDirectory + '/**')} (new; the kit is self-contained and runs before any npm install)`, ...ignoreFiles(report)],
    acceptance: [`${code('framework status --root ' + kitDirectory)} verifies the kit files against ${code('bin/kit.json')} (checksums, not signatures).`, 'The legacy build and test baseline from phase 0 gives identical results.', `${code('git status')} shows only ${code(kitDirectory)} and the ignore-file edits.`],
    notes: kitNotes(report),
  });
}
const agentFragment = (report: AdoptionReport): string => {
  const existing = report.agents.files.some(path => /^(?:AGENTS|CLAUDE)\.md$/.test(path));
  return `## Workbench\n\nThis project uses the Workbench CLI kit as a sidecar in ${kitDirectory}. Start with the ${skillName} skill.\nRun ${kitCommand} help before generating anything. Generated code lives only in the folder named in the adoption plan; never edit the kit.\n${existing ? '' : '(Create AGENTS.md with this section if the project has none.)'}`.trim();
};
function permissionFragment(): string {
  return JSON.stringify({ permissions: { allow: [`Bash(${kitCommand} adopt analyze *)`, `Bash(${kitCommand} help *)`, `Bash(${kitCommand} sketch show *)`] } }, null, 2);
}
export function phaseTwo(report: AdoptionReport): string[][] {
  const settings = report.agents.claudeSettings.present;
  return phase(2, 'Agent setup', {
    goal: 'Give coding agents the Workbench workflow without replacing any instruction or setting the project already has.',
    commands: `${kitCommand} adopt skill                 # preview: lists the two files and prints planHash\n${kitCommand} adopt skill --apply <planHash>\n# Merge by hand (additions only):\n#   AGENTS.md / CLAUDE.md: append the Workbench section below\n#   .claude/settings.json: add read-only permissions for "${kitCommand} adopt *"`,
    files: skillRoots.map(root => `${code(`${root}/${skillName}/SKILL.md`)} (new; existing different files are refused)`)
      .concat([`${code('AGENTS.md')} and ${code('CLAUDE.md')}: ${report.agents.files.some(path => /^(?:AGENTS|CLAUDE)\.md$/.test(path)) ? 'append a Workbench section; keep every existing line' : 'create or skip; none exists today'}`,
        `${code('.claude/settings.json')}: ${settings ? 'merge the allow entries into the existing permissions; keep existing hooks' : 'create only if you want agent permissions; hooks are not needed yet'}`]),
    acceptance: ['The diff of each existing agent file contains only added lines.', `The ${skillName} skill is listed by the agent tools in use (${list(report.agents.skills, 'none installed yet')} today).`, 'No hook runs the kit or the project scripts automatically.'],
    extra: [['Suggested section for the instruction files:', '', ...fence(agentFragment(report), 'md')],
      [`Read-only permissions to merge into ${code('.claude/settings.json')} (the write commands stay behind the normal approval prompt):`, '', ...fence(permissionFragment(), 'json')]],
  });
}
function pageTitle(route: string): string {
  const words = route.split('/').filter(part => part && !part.startsWith(':') && part !== '**').join(' ').replace(/[-_.]+/g, ' ').trim();
  return words.replace(/\b\w/g, letter => letter.toUpperCase()).slice(0, 60);
}
/** A sketch request describing existing routes as pages: titles and unique aliases only, no behavior. */
export function screensRequest(report: AdoptionReport): string {
  const aliases = new Set<string>(), operations: Array<{ op: string; title: string; as: string }> = [];
  const titles = (report.angular?.routing.paths ?? []).map(pageTitle).filter(Boolean);
  for (const title of titles.length ? titles : ['Overview']) {
    const alias = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
    if (aliases.has(alias) || aliases.size >= 10) continue;
    aliases.add(alias);
    operations.push({ op: 'page.add', title, as: alias });
  }
  return JSON.stringify({ schemaVersion: 1, title: report.target.name.slice(0, 100) || 'Existing project', operations }, null, 2);
}
function styleNotes(report: AdoptionReport): string[] {
  const notes: string[] = [];
  const existing = [...report.ui.tokenFiles, ...report.ui.themeFiles];
  if (existing.length) notes.push(`Existing theme or token files (${existing.slice(0, 5).map(code).join(', ')}) are not imported automatically; review them when you choose the design system for generated screens.`);
  if (report.angular?.libraries.includes('Angular Material')) notes.push('The legacy app uses Angular Material; generated screens use Workbench components, so visual consistency is a design decision.');
  return notes;
}
export function phaseThree(report: AdoptionReport): string[][] {
  const routes = report.angular?.routing.paths ?? [];
  return phase(3, 'Describe the existing screens (design import)', {
    goal: 'Record what exists today as a Workbench design so new screens are authored against the same vocabulary. This is description only: nothing is generated.',
    commands: `${kitCommand} sketch schema --json\n# save the request below as ${documentationDirectory}/screens.request.json, then preview and apply it\n${kitCommand} sketch --input ${documentationDirectory}/screens.request.json --json --no-interaction\n${kitCommand} sketch --input ${documentationDirectory}/screens.request.json --apply <planHash> --json --no-interaction\n${kitCommand} compiler check --input ${designFile} --root . --json`,
    files: [`${code(documentationDirectory + '/screens.request.json')} (new, from the request above)`, `${code(designFile)} (new, written by the reviewed sketch plan)`],
    acceptance: [`${code('sketch show --json')} lists one page per route you chose to describe (${routes.length ? routes.slice(0, 10).map(code).join(', ') : 'no routes were detected; edit the request by hand'}).`, `${code('compiler check')} (run from the project root with ${code('--root .')}) reports no errors for ${code(designFile)} (it does not write).`, 'The legacy source tree is unchanged.'],
    notes: [`Routes in the report: ${routes.length ? routes.slice(0, 12).map(route => code(plain(route))).join(', ') : 'none'}.`, ...styleNotes(report)],
    extra: [['Request derived from the routes in the report (edit titles, drop internal routes):', '', ...fence(screensRequest(report), 'json')]],
  });
}
