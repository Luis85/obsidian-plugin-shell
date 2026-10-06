/** ENGINEERING_HANDOFF_GUIDE.md: how to shape a design for this codebase, stated only from facts read from its own files. */
import type { SketchDocument } from '../domain/document.ts';
import type { EngineeringFacts } from '../domain/design-facts.ts';
import { interactions } from '../domain/interactions.ts';
import { cell, screens } from './design-context.ts';
export interface EngineeringGuideInput {
  name: string; title: string; document: SketchDocument; facts: EngineeringFacts;
  target: { targets: string[]; framework: string; source: string }; targetLabel: string;
}
const code = (value: string) => '`' + value.replaceAll('`', "'") + '`';
const none = (text: string) => [`_${text}_`, ''];
/** Gates a contributor runs, in the order they are usually needed; only scripts the project really declares are named. */
const gateScripts = ['typecheck', 'lint', 'test', 'build', 'build:prototype', 'check', 'check:style-literals', 'test:e2e', 'ui:gallery', 'verify'];
function architecture(input: EngineeringGuideInput): string[] {
  const { facts, target } = input, pkg = facts.packageJson;
  return ['## 1. Target architecture', '',
    `- Target: ${input.targetLabel}, frontend ${code(target.framework)} (source: ${target.source}).`,
    `- Source code lives in ${code(facts.codebase + '/')} and tests in ${code(facts.tests + '/')} (source: the project model settings).`, '',
    ...(pkg?.stack.length ? ['| Package | Exact version | Role |', '| --- | --- | --- |', ...pkg.stack.map(item => `| ${code(item.name)} | ${item.version} | ${item.role} |`),
      '', `Source: ${code('package.json')}. Design for these versions; a pattern that needs another library is a decision for engineering, not the prototype.`, '']
      : none('No package.json with known UI packages was found at the project root, so the stack is unknown. Ask engineering before choosing component patterns.')),
    ...(facts.layout.length ? ['Top-level folders under ' + code(facts.codebase + '/') + ' (file counts):', '',
      facts.layout.map(item => `${code(item.folder === '.' ? facts.codebase + '/*' : facts.codebase + '/' + item.folder + '/')} ${item.files}`).join(' · '), ''] : []),
    ...(facts.placement.length ? ['Where implementation code goes (folders that exist in this project):', '',
      ...facts.placement.map(item => `- ${code(item.path + '/')}: ${item.role}`), ''] : []),
  ];
}
function screenFiles(input: EngineeringGuideInput, id: string): string[] {
  const { trace, origins } = input.facts;
  const pages = (trace?.definitions ?? []).filter(item => item.kind === 'page' && item.owner === id).map(item => item.component);
  return [...new Set([...pages, ...(origins.get(id) ?? [])])];
}
function screenMap(input: EngineeringGuideInput): string[] {
  const list = screens(input.document), source = [input.facts.trace && 'design/visual-traceability.json', input.facts.origins.size && 'design/compiler-origins.json'].filter(Boolean);
  return ['## 2. Where each screen is implemented', '',
    source.length ? `Source: ${source.map(path => code(String(path))).join(' and ')}, written by the project compiler.` : '_The project has no compiler traceability files yet, so no screen has generated code. Every screen below is implemented new; keep its ID._', '',
    '| Screen | ID | Implementation files today |', '| --- | --- | --- |',
    ...list.map(screen => { const files = screenFiles(input, screen.id); return `| ${cell(screen.title)} | ${code(screen.id)} | ${files.length ? files.map(code).join('<br>') : 'not generated yet'} |`; }), ''];
}
function interactionMap(input: EngineeringGuideInput): string[] {
  const traced = input.facts.trace?.interactions ?? [];
  const modelled = screens(input.document).flatMap(screen => interactions(input.document, screen.id).map(({ interaction }) => ({ id: interaction.id, label: interaction.label, screen: screen.id })));
  return ['## 3. Interactions and their code hooks', '',
    ...(traced.length ? [`Source: ${code('design/visual-traceability.json')}. Each interaction already has an implementation hook and a test; the prototype must show what triggers it and what the user sees afterwards.`, '',
      '| Interaction | ID | Screen | Verification | Implementation | Test |', '| --- | --- | --- | --- | --- | --- |',
      ...traced.map(item => `| ${cell(item.label)} | ${code(item.id)} | ${code(item.nodeId)} | ${item.verification} | ${item.implementation ? code(item.implementation) : '—'} | ${item.test ? code(item.test) : '—'} |`), '']
      : modelled.length ? ['No generated hooks yet. These interactions come from the project model and keep their IDs when code is generated:', '',
        ...modelled.map(item => `- ${item.label} (${code(item.id)}) on screen ${code(item.screen)}`), ''] : none('The project model defines no interactions yet. Propose them in notes/decisions.md.')),
  ];
}
function components(input: EngineeringGuideInput): string[] {
  const { facts } = input, listed = facts.components.slice(0, 40);
  return ['## 4. Components to build with', '',
    ...(listed.length ? [`Existing component files under ${code(facts.codebase + '/')} (${facts.components.length} found${facts.components.length > listed.length ? ', first 40 shown' : ''}). Reuse their patterns before inventing new ones:`, '',
      ...listed.map(path => `- ${code(path)}`), ''] : none(`No component files were found under ${facts.codebase}/.`)),
    ...(facts.libraryUsage.length ? ['Library components already in use (number of files that import or render them). Compose from these first; every additional library component adds styles that must be reviewed:', '',
      facts.libraryUsage.map(item => `${code(item.name)} ${item.uses}`).join(' · '), ''] : []),
    `The model's own components and their IDs are in ${code('context/components.md')}; one design per component, reused on every screen that lists it.`, ''];
}
function styling(input: EngineeringGuideInput): string[] {
  const { tokens, packageJson } = input.facts, gate = packageJson?.scripts.includes('check:style-literals');
  return ['## 5. Styling contract', '',
    ...(tokens ? [`Source: ${code(tokens.file)} declares ${tokens.aliases.length} custom properties${tokens.scopes.length ? `, scoped to ${tokens.scopes.map(code).join(', ')}` : ''}. Use these names for colour, spacing, radius and type, with a neutral fallback only for standalone preview, for example ${code(`var(${tokens.aliases[0]!.name}, #888)`)}:`, '',
      '| Use | Resolves to |', '| --- | --- |', ...tokens.aliases.map(alias => `| ${code(alias.name)} | ${code(alias.value)} |`), '']
      : none('No token stylesheet was found. Use the variables in context/design-tokens.md and record every new variable in notes/decisions.md.')),
    gate ? `Raw colour literals in the implementation fail ${code('npm run check:style-literals')}, so a colour that has no token above needs a decision note, not a hex value.` : 'Keep raw colour literals out of designs anyway; they have to be mapped to tokens before implementation.', ''];
}
function budgets(input: EngineeringGuideInput): string[] {
  const { limits, packageJson } = input.facts, gates = gateScripts.filter(name => packageJson?.scripts.includes(name));
  return ['## 6. Size and quality budgets', '',
    ...(limits ? [`Source: ${code('configs/quality/thresholds.json')}. A source file holds at most ${limits.source} code lines and a test file ${limits.tests}. Design a dense screen as named regions that can become separate components within that budget.`, ''] : []),
    ...(gates.length ? [`Gates the implementation must pass (scripts declared in ${code('package.json')}): ${gates.map(name => code('npm run ' + name)).join(', ')}.`, ''] : none('No gate scripts were found in package.json.')),
  ];
}
function documentation(input: EngineeringGuideInput): string[] {
  return ['## 7. Documentation the implementation follows', '',
    ...(input.facts.docs.length ? input.facts.docs.map(doc => `- ${code(doc.path)}: ${doc.title}`) : ['_No architecture documents were found at the expected paths._']), ''];
}
function checklist(input: EngineeringGuideInput): string[] {
  return ['## 8. Prepare the design for handoff', '',
    '1. Make one prototype per screen ID from section 2, saved as `prototypes/<screen-id>--<variant>.html`.',
    '2. Put `data-design-id` on every screen, component and interaction element, using the IDs from sections 2 and 3 and from `context/components.md`.',
    '3. Take colours, spacing, radius and type only from section 5. Note every new value in `notes/decisions.md` with the closest existing token.',
    '4. Build from the components in section 4. For anything new, record in `notes/decisions.md` which existing component came closest and why it does not fit.',
    input.target.framework === 'none' ? '5. Show the success, empty and failure output of every command, and its `--json` form.'
      : '5. Show the empty, loading, error and populated states, keyboard focus, and both themes for every screen that lists or edits data.',
    input.facts.limits ? '6. Mark repeated regions as named components, so each implementation file stays within the budget in section 6.'
      : '6. Mark repeated regions as named components, so each becomes one small, reusable implementation file.',
    '7. Describe business rules, persistence and permissions in `notes/decisions.md` instead of encoding them in prototype scripts.',
    '8. In `handoff/implementation-map.md`, list the prototype files and the target files from section 2, then set the row to `ready`.', ''];
}
function sources(input: EngineeringGuideInput): string[] {
  return ['## Sources', '', `Fingerprint ${code(input.facts.fingerprint.slice(0, 16))}. ${code(`node bin/app design status --name ${input.name}`)} reports this guide as stale when any source changes.`, '',
    '| Source | SHA-256 | Note |', '| --- | --- | --- |',
    ...input.facts.sources.map(item => `| ${code(item.path)} | ${code(item.sha256.slice(0, 12))} | ${item.note ?? 'read'} |`),
    `| ${code(input.target.source)} | — | target selection |`, ''];
}
export function engineeringGuide(input: EngineeringGuideInput): string {
  return [`# ${input.title}: engineering handoff guide`, '',
    `How to shape the **${input.title}** design so Claude Code can implement it in this codebase without guessing. Every statement below is read from the project's own files, which are listed under Sources; nothing is assumed. ${code(`node bin/app design sync --name ${input.name}`)} regenerates this guide.`, '',
    ...architecture(input), ...screenMap(input), ...interactionMap(input), ...components(input), ...styling(input), ...budgets(input), ...documentation(input), ...checklist(input), ...sources(input),
  ].join('\n');
}
