/** The generated project's developer and agent kit: product README/AGENTS.md, Claude Code settings
 * and skills, VS Code configuration, product CI, and a Vitest config wired to the Obsidian test kit.
 * Every file is 'extension' ownership: regeneration keeps a developer's edits and reports a conflict
 * instead of overwriting when the template itself changed. */
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';

const templates: ReadonlyArray<readonly [string, string]> = [
  ['README.md', 'README.md.tmpl'], ['AGENTS.md', 'AGENTS.md.tmpl'], ['CLAUDE.md', 'CLAUDE.md.tmpl'],
  ['.claude/settings.json', 'claude-settings.json.tmpl'],
  ...['implement-requirement', 'debug-in-obsidian', 'add-feature', 'write-obsidian-test'].map(skill => [`.claude/skills/${skill}/SKILL.md`, `skill-${skill}.md.tmpl`] as const),
  ['.github/copilot-instructions.md', 'agent-pointer.md.tmpl'], ['.cursor/rules/project.mdc', 'cursor-rule.mdc.tmpl'],
  ['.vscode/extensions.json', 'vscode-extensions.json.tmpl'], ['.vscode/settings.json', 'vscode-settings.json.tmpl'],
  ['.vscode/launch.json', 'vscode-launch.json.tmpl'], ['.vscode/tasks.json', 'vscode-tasks.json.tmpl'],
  ['.editorconfig', 'editorconfig.tmpl'], ['.github/workflows/ci.yml', 'workflow-ci.yml.tmpl'], ['.github/workflows/obsidian.yml', 'workflow-obsidian.yml.tmpl'],
];
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
export async function devkitFiles(templateRoot: string, m: Model, add: Add): Promise<void> {
  const project = m.project as unknown as Record<string, unknown>;
  const values = { name: oneLine(project.name) || String(m.project.id), id: String(m.project.id),
    description: oneLine(project.description) || 'An Obsidian plugin.', sourceRoot: m.sourceRoot, testRoot: m.testRoot };
  for (const [path, template] of templates) {
    add(path, renderTemplate(await readFile(join(templateRoot, 'scripts/companion/devkit', template), 'utf8'), values), 'extension');
  }
  add('vitest.project.config.mjs', projectVitestConfig(m), 'extension');
  const example = `${m.testRoot}/plugin-host.test.ts`;
  add(example, pluginHostTest(example, posix.relative(posix.dirname(example), 'tests/obsidian/vault')), 'extension');
}
/** Same shared build config and throwing `obsidian` boundary as the framework's own Vitest config. */
function projectVitestConfig(m: Model): string {
  return `import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { sharedConfig } from './scripts/bundling/vite-shared.mjs';
const shared = sharedConfig();
// Product tests. A bare \`obsidian\` import throws on purpose: each test file opts in to the
// in-memory host with \`vi.mock('obsidian', () => import('@test/obsidian'))\` (docs/testing/OBSIDIAN-TEST-KIT.md).
const hostBoundary = { name: 'vitest-obsidian-boundary',
  resolveId(id) { if (id === 'obsidian') return '\\0obsidian-host-boundary'; },
  load(id) { if (id === '\\0obsidian-host-boundary') return 'throw new Error("OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE")'; },
};
const testKit = { '@test/obsidian': fileURLToPath(new URL('./tests/support/obsidian/index.ts', import.meta.url)) };
// DOM tests (views, settings, Vue components) start with \`// @vitest-environment happy-dom\`.
// Reporters are left at Vitest's defaults so coding agents automatically get the concise \`agent\` reporter.
// \`npm run make\` writes the tests of the features it creates to ${makerTests}.
export default defineConfig({ ...shared, resolve: { ...shared.resolve, alias: { ...shared.resolve?.alias, ...testKit } }, plugins: [...shared.plugins, hostBoundary], test: {
  include: [${literal(m.testRoot + '/**/*.test.{ts,mjs}')}, ${literal(makerTests + '/**/*.test.ts')}], environment: 'node', fileParallelism: false,
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
