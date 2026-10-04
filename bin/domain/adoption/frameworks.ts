import type { AngularFacts, FrameworkFact } from './contracts.ts';
import type { PackageFacts } from './manifest.ts';
import { textField, type InventoryView } from './source.ts';
import { versionOf } from './version.ts';

/** Web and tooling frameworks recognised from package dependencies; the first column is the report id. */
const dependencyFrameworks: ReadonlyArray<[string, string]> = [
  ['react', 'react'], ['next', 'next'], ['vue', 'vue'], ['nuxt', 'nuxt'], ['svelte', 'svelte'], ['sveltekit', '@sveltejs/kit'],
  ['solid', 'solid-js'], ['preact', 'preact'], ['astro', 'astro'], ['lit', 'lit'], ['vite', 'vite'],
];
function fromDependency(packages: PackageFacts, id: string, name: string): FrameworkFact | null {
  const dependency = packages.dependencies.get(name);
  return dependency ? { id, version: versionOf(dependency.range) ?? dependency.range, detail: null, evidence: [dependency.file] } : null;
}
function angularFact(angular: AngularFacts, packages: PackageFacts): FrameworkFact {
  const evidence = [packages.dependencies.get('@angular/core')?.file, angular.workspace === 'dependency-only' ? undefined : angular.workspace];
  return { id: 'angular', version: angular.version, detail: angular.workspace, evidence: [...new Set(evidence.filter((item): item is string => item !== undefined))] };
}
/** An Obsidian plugin manifest has an id and minAppVersion at the project root. */
function obsidianFact(view: InventoryView, packages: PackageFacts): FrameworkFact | null {
  const manifest = view.json('manifest.json');
  const minimum = textField(manifest, 'minAppVersion');
  if (minimum === null || textField(manifest, 'id') === null) return null;
  const evidence = ['manifest.json', ...(packages.dependencies.has('obsidian') ? [packages.dependencies.get('obsidian')!.file] : [])];
  return { id: 'obsidian-plugin', version: textField(manifest, 'version'), detail: `minAppVersion ${minimum}`, evidence: [...new Set(evidence)] };
}
function plainLanguage(view: InventoryView): FrameworkFact | null {
  const typescript = view.count(/\.(?:ts|tsx|mts|cts)$/) - view.count(/\.d\.ts$/);
  const javascript = view.count(/\.(?:js|jsx|mjs|cjs)$/);
  if (typescript <= 0 && javascript <= 0) return null;
  const id = typescript > 0 ? 'typescript' : 'javascript';
  return { id: `plain-${id}`, version: null, detail: `${Math.max(typescript, javascript)} source files`, evidence: [] };
}
export function readFrameworks(view: InventoryView, packages: PackageFacts, angular: AngularFacts | null): FrameworkFact[] {
  const found: Array<FrameworkFact | null> = [angular ? angularFact(angular, packages) : null];
  for (const [id, name] of dependencyFrameworks) found.push(fromDependency(packages, id, name));
  found.push(obsidianFact(view, packages));
  const facts = found.filter((item): item is FrameworkFact => item !== null);
  const application = facts.filter(item => !['vite', 'obsidian-plugin'].includes(item.id));
  if (!application.length) {
    const plain = plainLanguage(view);
    if (plain) facts.push(plain);
  }
  return facts;
}
