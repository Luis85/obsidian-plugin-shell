import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import { json, type Model } from '../../companion/compiler/model.ts';

/** The target packages the shared v6 browser composition; it never substitutes another renderer. */
export function clickdummyFiles(model: Model, template: TemplateSnapshot, files: Artifact[]): Artifact[] {
  const worker = '.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs';
  if (!template.skillFiles.some(file => file.path === worker)) {
    throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'lower', 'Click-dummy output requires the bundled prototype builder.'));
  }
  if (!files.some(file => file.path === 'harness/prototype/clickdummy.ts')) {
    throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'emit', 'The shared browser composition is missing.'));
  }
  const add = (path: string, content: string): Artifact => ({ path, content, ownership: 'managed', producer: 'clickdummy' });
  const pkgFile = files.find(file => file.path === 'package.json')!;
  const pkg = JSON.parse(pkgFile.content);
  pkg.scripts['build:clickdummy'] = 'node scripts/compiler/build-clickdummy.mjs';
  pkg.scripts['typecheck:clickdummy'] = 'node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --project configs/types/tsconfig.clickdummy.json';
  return [...files.filter(file => file.path !== 'package.json'), { ...pkgFile, content: json(pkg) },
    add('configs/types/tsconfig.clickdummy.json', json({ extends: './tsconfig.project.json', include: [
      'harness/prototype/**/*.ts', model.sourceRoot + '/**/*.ts', model.sourceRoot + '/**/*.vue',
    ].map(path => '../../' + path) })),
    // Preserve the compiler entry path while delegating all behavior to the parent's composition.
    add('harness/prototype/main.ts', `import './clickdummy.ts';
import { nextTick } from 'vue';
void nextTick(() => {
  if (document.querySelector('.clickdummy-preview')) document.documentElement.dataset.prototypeReady = 'true';
});
window.addEventListener('pagehide', () => { delete document.documentElement.dataset.prototypeReady; }, { once: true });
`),
    add('CLICKDUMMY.md', `# Click-dummy output

This target uses the same generated Vue pages, services, navigation and browser composition as the plugin project. Synthetic read adapters return independent schema-valid values; business writes and missing handlers fail explicitly. Preview states, surface navigation, dialogs, reset and complete project JSON export are retained. No Obsidian host or vault is opened.

Use the labelled Authored scenario selector to preview a page's saved sample bindings, values, state and wide/narrow layout intent. Choices belong to the current canonical surface; navigation and Reset preview clear them. Switching scenarios resets unsaved local interactions. Empty choices are not invented for pages without authored scenarios.

In an authored scenario, local edits, navigation and modal opening remain simulations; source actions and implementation hooks are refused without claiming a saved result. Synthetic reads (no scenario) restores the existing browser-only adapter behavior. The separate Preview state control can override the displayed state. Scenario selection never changes the exported project JSON. Modal scenarios are not independently selectable in this increment; narrow layout intent is not device qualification.

Review dependency readiness in design/compiler-readiness.json. Install explicitly, then run npm run typecheck:clickdummy and npm run build:clickdummy. The shipped offline builder embeds the libraries and blocks external requests. Existing output is preserved; use node scripts/compiler/build-clickdummy.mjs --replace for a deliberate replacement.

Bundling is not browser or business acceptance. External component adapters remain explicit implementation points.
`),
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
