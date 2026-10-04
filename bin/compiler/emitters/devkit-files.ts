import type { TemplateSnapshot } from '../domain/contracts.ts';
/** The generated project's developer and agent kit: product README/AGENTS.md, Claude Code settings
 * and skills, VS Code configuration, product CI, and a Vitest config wired to the Obsidian test kit.
 * Every file is 'extension' ownership: regeneration keeps a developer's edits and reports a conflict
 * instead of overwriting when the template itself changed. */
import { posix } from 'node:path';
import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
import { clickdummyBuilderFiles } from './clickdummy-builder-files.ts';
import { briefValues } from './devkit-brief.ts';
import { hostingProfile, projectHosting, type HostingProfile } from '../../../scripts/companion/hosting-contract.mjs';

/** Product skills; each also gets a Codex entrypoint under `.agents/skills/` pointing at the canonical Claude skill. */
const productSkills = ['implement-requirement', 'debug-in-obsidian', 'add-feature', 'write-obsidian-test', 'self-review'] as const;
const sharedTemplates: ReadonlyArray<readonly [string, string]> = [
  ['README.md', 'README.md.tmpl'], ['AGENTS.md', 'AGENTS.md.tmpl'], ['CLAUDE.md', 'CLAUDE.md.tmpl'],
  ['.claude/settings.json', 'claude-settings.json.tmpl'],
  ...productSkills.map(skill => [`.claude/skills/${skill}/SKILL.md`, `skill-${skill}.md.tmpl`] as const),
  ['BRIEF.md', 'BRIEF.md.tmpl'], ['docs/project-tasks/TEMPLATE.md', 'project-task-template.md.tmpl'],
];
const editorTemplates: ReadonlyArray<readonly [string, string]> = [['.cursor/rules/project.mdc', 'cursor-rule.mdc.tmpl'],
  ['.vscode/extensions.json', 'vscode-extensions.json.tmpl'], ['.vscode/settings.json', 'vscode-settings.json.tmpl'],
  ['.vscode/launch.json', 'vscode-launch.json.tmpl'], ['.vscode/tasks.json', 'vscode-tasks.json.tmpl'], ['.editorconfig', 'editorconfig.tmpl']];
/** Shared files, the platform's review files, editor files, then the platform's CI files (the GitHub order is unchanged). */
function devkitTemplates(hosting: HostingProfile): ReadonlyArray<readonly [string, string]> {
  return [...sharedTemplates, ...hosting.reviewFiles, ...editorTemplates, ...hosting.ciFiles];
}
/** Platform permissions join the template's lists; without any, the rendered bytes stay exactly as they are. */
function withHostingPermissions(settings: string, hosting: HostingProfile): string {
  const extra = hosting.claudePermissions;
  if (!extra.allow.length && !extra.ask.length && !extra.deny.length) return settings;
  const parsed: unknown = JSON.parse(settings);
  const permissions: unknown = parsed && typeof parsed === 'object' ? Reflect.get(parsed, 'permissions') : undefined;
  if (!permissions || typeof permissions !== 'object') throw new Error('GENERATOR_TEMPLATE_SETTINGS: permissions are missing.');
  for (const decision of ['allow', 'ask', 'deny'] as const) {
    const list: unknown = Reflect.get(permissions, decision);
    if (!Array.isArray(list)) throw new Error('GENERATOR_TEMPLATE_SETTINGS: ' + decision + ' is not a list.');
    list.push(...extra[decision]);
  }
  return JSON.stringify(parsed, null, 2) + '\n';
}
/** Single-pass `{{name}}` substitution; an unknown placeholder is a template defect, never output. */
export function renderTemplate(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{([A-Za-z]+)\}\}/g, (_match, key: string) => {
    if (!Object.hasOwn(values, key)) throw new Error('GENERATOR_TEMPLATE_PLACEHOLDER: ' + key);
    return values[key]!;
  });
}
/** Where the framework makers put the tests of generated features; product checks run them too. */
export const makerTests = 'tests/runtime/generated';
const oneLine = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
export function devkitFiles(templateRoot: TemplateSnapshot, m: Model, add: Add): void {
  const project = m.project as unknown as Record<string, unknown>;
  const hosting = hostingProfile(projectHosting(m.document));
  const values = { name: oneLine(project.name) || String(m.project.id), id: String(m.project.id),
    description: oneLine(project.description) || 'An Obsidian plugin.', sourceRoot: m.sourceRoot, testRoot: m.testRoot, ...briefValues(m),
    prTemplatePath: hosting.prTemplatePath, hostingCli: hosting.cliHints, hostingAgent: hosting.agentHint };
  const read = (template: string) => templateRoot.text(`templates/companion/devkit/${template}`);
  for (const [path, template] of devkitTemplates(hosting)) {
    const content = renderTemplate(read(template), values);
    add(path, path === '.claude/settings.json' ? withHostingPermissions(content, hosting) : content, 'extension');
  }
  const adapter = read('skill-codex-adapter.md.tmpl');
  for (const skill of productSkills) {
    const skillDescription = /^description: (.+)$/m.exec(read(`skill-${skill}.md.tmpl`))?.[1];
    if (!skillDescription) throw new Error('GENERATOR_TEMPLATE_SKILL_DESCRIPTION: ' + skill);
    add(`.agents/skills/${skill}/SKILL.md`, renderTemplate(adapter, { skill, skillDescription }), 'extension');
  }
  for (const file of clickdummyBuilderFiles(templateRoot.skillFiles)) add(file.path, file.content, 'extension');
  add('configs/testing/vitest.project.config.mjs', projectVitestConfig(m), 'extension');
  add(`${m.testRoot}/ui-bootstrap.mjs`, `// Install the actual locally bundled icons, not a mock or a remote provider.
import { addIcon } from '@iconify/vue';
import { init } from 'virtual:nuxt-ui-icons';
init(addIcon);
`, 'managed');
  // The copied suite manifest classifies product tests under tests/project; follow a custom tests folder.
  if (m.testRoot !== 'tests/project') {
    const suites = templateRoot.text('tests/suites.json');
    add('tests/suites.json', suites.replaceAll('"tests/project', JSON.stringify(m.testRoot).slice(0, -1)), 'framework');
  }
  const example = `${m.testRoot}/plugin-host.test.ts`;
  add(example, pluginHostTest(example, posix.relative(posix.dirname(example), 'tests/obsidian/vault')), 'extension');
}
/** Same shared build config and throwing `obsidian` boundary as the framework's own Vitest config. */
function projectVitestConfig(m: Model): string {
  return `import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { sharedConfig } from '../../scripts/bundling/vite-shared.mjs';
const shared = sharedConfig();
// Product tests. A bare \`obsidian\` import throws on purpose: each test file opts in to the
// in-memory host with \`vi.mock('obsidian', () => import('@test/obsidian'))\` (docs/testing/OBSIDIAN-TEST-KIT.md).
const hostBoundary = { name: 'vitest-obsidian-boundary',
  resolveId(id) { if (id === 'obsidian') return '\\0obsidian-host-boundary'; },
  load(id) { if (id === '\\0obsidian-host-boundary') return 'throw new Error("OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE")'; },
};
const testKit = { '@test/obsidian': fileURLToPath(new URL('../../tests/support/obsidian/index.ts', import.meta.url)) };
// DOM tests (views, settings, Vue components) start with \`// @vitest-environment happy-dom\`.
// Reporters are left at Vitest's defaults so coding agents automatically get the concise \`agent\` reporter.
// \`npm run make\` writes the tests of the features it creates to ${makerTests}.
export default defineConfig({ ...shared, resolve: { ...shared.resolve, alias: { ...shared.resolve?.alias, ...testKit } }, plugins: [...shared.plugins, hostBoundary], test: {
  include: [${literal(m.testRoot + '/**/*.test.{ts,mjs}')}, ${literal(makerTests + '/**/*.test.ts')}], environment: 'node', fileParallelism: false,
  // Playwright specs (npm run test:e2e) run in a browser, never in Vitest.
  exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  setupFiles: [${literal(m.testRoot + '/ui-bootstrap.mjs')}],
} });
`;
}
/** One real, starter-independent test of the built plugin entry against the in-memory Obsidian host. */
function pluginHostTest(path: string, vault: string): string {
  return `// @vitest-environment happy-dom
// Example of the in-memory Obsidian test kit (docs/testing/OBSIDIAN-TEST-KIT.md): the real plugin
// entry loads against a fake vault and workspace seeded from the real-Obsidian fixture vault.
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App } from 'obsidian';
import { createTestApp, loadVaultFixtures } from '@test/obsidian';
import GeneratedPlugin from ${literal(relativeImport(path, 'src/main.ts'))};
import manifest from ${literal(relativeImport(path, 'manifest.json'))};

afterEach(() => { document.body.replaceChildren(); });

it('loads in Obsidian, opens its workbench, toggles debug logging and unloads without touching notes', async () => {
  // A path, not \`new URL(..., import.meta.url)\`: Vite rewrites that pattern to http: URLs under happy-dom.
  const files = loadVaultFixtures(join(import.meta.dirname, ${literal(vault)}));
  const app = new App(); const kit = createTestApp({ app, files });
  const plugin = new GeneratedPlugin(app, manifest);
  await kit.loadPlugin(plugin);
  const ids = kit.commands().map(command => command.id);
  expect(ids).toEqual(expect.arrayContaining(['open-project', 'debug-toggle', 'debug-report'].map(id => \`\${manifest.id}:\${id}\`)));

  expect(await kit.runCommand('open-project')).toBe(true);
  await vi.waitFor(() => expect(app.workspace.getLeavesOfType(\`\${manifest.id}-view-project-workbench\`)).toHaveLength(1));
  const [leaf] = app.workspace.getLeavesOfType(\`\${manifest.id}-view-project-workbench\`);
  await vi.waitFor(() => expect(leaf?.view.containerEl.querySelector('.generated-workbench')).not.toBeNull());

  expect(await kit.runCommand('debug-toggle')).toBe(true);
  expect(kit.notices.map(notice => notice.message)).toContain('Debug logging enabled for this session.');

  await kit.unloadPlugin(plugin);
  expect(kit.commands()).toEqual([]);
  for (const [path, content] of Object.entries(files)) expect(kit.read(path)).toBe(content);
  expect(kit.errors).toEqual([]);
});
`;
}
