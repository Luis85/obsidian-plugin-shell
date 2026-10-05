import type { AdoptionReport } from './contracts.ts';
import { designFile, documentationDirectory, generatedAppDirectory, kitCommand, kitDirectory, reportPath } from './paths.ts';
import { code, fence } from './plan-markdown.ts';
import { baselineScripts, phase, scriptCommand } from './plan-phases.ts';
import { stackOf, type Recommendation } from './strategy.ts';

const starterFor = (stack: Recommendation['stack']): string => stack === 'vue' ? 'webapp-nuxtui' : 'webapp-angular';
const appCommands = (starter: string): string => `${kitCommand} new guide --starter ${starter} --json
# save data.input as ${documentationDirectory}/app.request.json; set answers.title and answers.pages from ${designFile}; set answers.approved only after design agreement
${kitCommand} new validate --input ${documentationDirectory}/app.request.json --json
${kitCommand} new --input ${documentationDirectory}/app.request.json --out ${generatedAppDirectory} --json    # preview, prints planHash
${kitCommand} new --input ${documentationDirectory}/app.request.json --out ${generatedAppDirectory} --apply <planHash> --json
cd ${generatedAppDirectory}/source && npm install && npm run typecheck && npm test && npm run build`;
const bridge = `// Mode 2 only, after the spike. Replace the import with what the generated package really exports.
{ path: 'workbench', canMatch: [() => inject(FeatureFlags).enabled('workbench-screens')],
  loadComponent: () => import('<generated entry>').then(module => module.<EntryComponent>) }`;
function integrationModes(): string[] {
  return ['**How the screen reaches users.** Decide with the owner; mode 1 is the default for the first feature.', '',
    `1. **Linked package (default).** Deploy the generated build beside the legacy app under its own path (the output folder is named in ${code(generatedAppDirectory + '/README.md')}) and link to it behind the flag. No shared build and no router change.`,
    '2. **Mounted route (optional, after a spike).** Lazy-load the generated entry from the legacy router. The spike answers: does the generated sample compile with the legacy Angular major; does its URL-hash routing (browser targets mirror their declared routes in the hash) collide with the legacy router, above all with a hash location strategy; do styles and change-detection settings stay contained.', '',
    'Illustrative route for mode 2 (adapt to the project; nothing here is generated for you):', '', ...fence(bridge, 'ts')];
}
function phaseFourPlugin(): string[][] {
  return phase(4, 'First reviewed change, evaluated in place', {
    goal: 'Prove the kit against the existing plugin without moving code: describe one view design-first and run the review gates.',
    commands: `${kitCommand} check submission --root .   # local mirror of the review rules; its lint step runs the project's ESLint configuration (trusted project code)\n${kitCommand} make list\n${kitCommand} make view <name> --feature <feature> --dry-run   # review only; apply later with --apply <planHash>`,
    files: [`${code(designFile)} (from phase 3)`, 'One reviewed `make` plan applied on a branch, only after you have compared the plugin layout with the shell layout it assumes.'],
    acceptance: ['The `make` preview lists only files you expect and nothing outside the plugin source folder.', 'The plugin builds and its tests pass exactly as in the phase 0 baseline.'],
    notes: ['Option C is the least proven path: commands such as generate and check assume a shell-generated layout. Treat any mismatch as a finding for the owner, not as something to work around.'],
  });
}
export function phaseFour(report: AdoptionReport, recommendation: Recommendation): string[][] {
  if (recommendation.primary === 'C') return phaseFourPlugin();
  const starter = starterFor(stackOf(report));
  const inTree = recommendation.primary === 'A';
  return phase(4, `First generated feature behind a ${inTree ? 'link or route and a flag' : 'link and a flag'}`, {
    goal: `Generate one small, reviewed screen into ${generatedAppDirectory} and expose it only to people who enable a flag.`,
    commands: appCommands(starter),
    extra: inTree ? [integrationModes()] : [],
    files: [`${code(generatedAppDirectory + '/**')} (new package; read README.md and INTEGRATION.md in it first)`, `${code(documentationDirectory + '/app.request.json')} (new)`,
      inTree ? 'One link, or one router file with a feature-flag entry for mode 2 (the only edits to legacy source in the whole plan).' : 'One navigation link in the legacy app behind a flag, or an external link, as the owner decides.'],
    acceptance: [`${code('npm run typecheck')}, ${code('npm test')} and ${code('npm run build')} pass inside ${code(generatedAppDirectory + '/source')}.`, 'With the flag off, the legacy app behaves exactly as in the phase 0 baseline.',
      'With the flag on, the generated screen opens; synthetic data and unfinished actions are labelled as such (the generator never invents a backend).', 'Business acceptance of the screen is a separate owner decision.'],
    notes: [`The generated package is a prepared prototype that still needs implementation (stage ${code('prepared-not-implemented')}): read ${code(generatedAppDirectory + '/execution-prompt.md')} and ${code(generatedAppDirectory + '/INTEGRATION.md')}; generation is not a finished feature.`,
      `The generated package keeps its own ${code('package.json')} and lock. The first install resolves the dependencies; commit the resolved lock before using ${code('npm ci')} anywhere else.`,
      `The package contains its own agent skills under ${code(generatedAppDirectory + '/source/.claude')}; they apply inside that folder only.`,
      ...(inTree ? [] : [`Deploy the package separately: its production build is a static browser app (see ${code(generatedAppDirectory + '/README.md')} for the output folder), served from its own path or host and linked from the legacy app.`])],
  });
}
function workflowSnippet(report: AdoptionReport): string[] {
  if (!report.tooling.ciProviders.includes('github-actions')) return [];
  const yaml = `name: workbench-app
on:
  pull_request:
    paths: ['${generatedAppDirectory}/**', '${kitDirectory}/**']
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: ${generatedAppDirectory}/source } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${report.targets.node.version ?? '24.21.0'}' }
      - run: npm install   # switch to npm ci once the resolved lock is committed
      - run: npm run typecheck && npm test && npm run build`;
  return ['A separate job keeps the legacy workflows untouched (GitHub Actions detected):', '', ...fence(yaml, 'yaml')];
}
/** Azure Repos ignores YAML pr: triggers, so the pipeline is queued by a build-validation branch policy with a path filter. */
function azurePipelineSnippet(report: AdoptionReport): string[] {
  if (!report.tooling.ciProviders.includes('azure-pipelines')) return [];
  const yaml = `# workbench-app.yml: queued by a build-validation branch policy with the path filter /${generatedAppDirectory}/*;/${kitDirectory}/*
trigger: none
pool:
  vmImage: ubuntu-latest
steps:
  - checkout: self
  - task: NodeTool@0
    inputs: { versionSpec: '${report.targets.node.version ?? '24.21.0'}' }
  - script: npm install   # switch to npm ci once the resolved lock is committed
    workingDirectory: ${generatedAppDirectory}/source
  - script: npm run typecheck && npm test && npm run build
    workingDirectory: ${generatedAppDirectory}/source`;
  return ['A separate pipeline keeps the legacy pipelines untouched (Azure Pipelines detected):', '', ...fence(yaml, 'yaml')];
}
export function phaseFive(report: AdoptionReport): string[][] {
  const legacy = baselineScripts(report).map(name => scriptCommand(report, name));
  return phase(5, 'Tests and CI gates', {
    goal: 'Protect both the legacy code and the new package with gates that run independently.',
    commands: `${legacy.length ? legacy.join('\n') : '# legacy gates: unchanged (none detected as scripts)'}\n${kitCommand} framework status --root ${kitDirectory}\ncd ${generatedAppDirectory}/source && npm run typecheck && npm test && npm run build`,
    extra: [workflowSnippet(report), azurePipelineSnippet(report)].filter(snippet => snippet.length > 0),
    files: [report.tooling.ciProviders.length ? `A new, separate CI job or workflow (${report.tooling.ciProviders.join(', ')} detected); existing jobs keep their current commands.` : 'A CI definition for the provider you choose; none exists today.', 'No change to legacy test configuration.'],
    acceptance: ['The legacy gates stay required and unchanged.', 'The new job fails when the generated package fails and cannot make the legacy job pass.', 'Gate results, not this plan, are the evidence; neither Workbench qualification nor release is implied.'],
  });
}
export function phaseSix(report: AdoptionReport, recommendation: Recommendation): string[][] {
  return phase(6, 'Rollout', {
    goal: 'Move from a flagged experiment to normal use in explicit, reversible steps.',
    commands: `git log --oneline workbench/adoption   # one reviewable commit per phase\n${kitCommand} adopt analyze --out ${reportPath} --replace   # re-run after each phase and compare findings`,
    files: [`${code(reportPath)} (optional record of the latest analysis; created only if you pass --out)`],
    acceptance: ['The flag stays off by default until the owner accepts the first screen.', recommendation.primary === 'A' ? 'Enabling for everyone is a separate pull request that removes the flag.' : 'Linking for everyone is a separate pull request that removes the flag.', 'A named person owns the generated folder and its upgrades.'],
    notes: [`Workbench itself is not released as a product yet; pin the kit version you extracted and treat upgrades with ${code('framework upgrade')} as reviewed changes.`, `Agents: ${report.agents.files.length ? 'existing instruction files stay authoritative' : 'no instruction files existed; the Workbench section from phase 2 is the first'}.`],
  });
}
