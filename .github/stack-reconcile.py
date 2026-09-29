from pathlib import Path
import subprocess,re,json,hashlib
root=Path.cwd()
def git(*args): return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
def run(*args): subprocess.run(['git',*args],cwd=root,check=True)
def show(ref,path): return subprocess.check_output(['git','show',f'{ref}:{path}'],cwd=root).decode()
def put(path,s): (root/path).parent.mkdir(parents=True,exist_ok=True);(root/path).write_text(s)
def edit(path,fn): p=root/path; p.write_text(fn(p.read_text()))
def merge(ref):
 result=subprocess.run(['git','merge','--no-commit','--no-ff',ref],cwd=root)
 if result.returncode not in [0,1]: raise RuntimeError('Merge failed')
def commit(message,tree):
 run('add','-A')
 actual=git('write-tree')
 if actual!=tree: raise RuntimeError(f'Tree mismatch: {actual} != {tree}')
 run('commit','-m',message)
run('checkout','-b','reconcile43','55457512374faa1a6215824cf8983626f427b622')
merge('b39cde0015f78beb2cf10160fe119cf409211a0d')
p='scripts/compiler/adapters/workspace-plan.ts'
s=(root/p).read_text()
s=re.sub(r'<<<<<<< HEAD\n.*?=======\n.*?>>>>>>>[^\n]*\n', "  const receipt = {...generationReceipt(text(model.project.id), input.content.toString('utf8'), ownership),...(options.selection ? {selection:options.selection} : {})};\n",s,flags=re.S)
put(p,s)
p='tests/suites.json';s=(root/p).read_text()
s=re.sub(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>>[^\n]*\n',lambda m:m[1]+'    },\n    {\n'+m[2],s,flags=re.S);put(p,s)
commit('fix: reconcile maker CLI with current PR5 compiler scopes and source-handoff suites','5488bfefb5e863ff361d6f9bde935b79b5e16296')
run('checkout','-b','reconcile46','bad326c0c782227da480e1f4099496af632b4869')
merge('reconcile43')
for name in ['project-presets','project-prototype']:
 put(f'bin/guides/legacy-{name}.json',show('reconcile43',f'bin/guides/{name}.json'))
put('scripts/compiler/qualify-legacy-presets.mjs',show('reconcile43','scripts/compiler/qualify-presets.mjs'))
put('bin/LEGACY-PROJECT-PRESETS.md',show('reconcile43','bin/README.md'))
conflicts=git('diff','--name-only','--diff-filter=U').splitlines()
for path in conflicts: put(path,show('bad326c0',path))
edit('tests/tooling/interactive-maker-tui-process.checks.mjs',lambda s:s.replace("['studio', 'new', 'prototype']","['studio', 'new', 'sketch', 'prototype']").replace("screen.includes('What kind of project') || screen.includes('Prototype title')","screen.includes('What kind of project') || screen.includes('Project title') || screen.includes('Prototype title')"))
edit('shell.mjs',lambda s:s.replace("if (args[0] === 'make' && args[1] === 'prototype')", "if (args[0] === 'make' && args[1] === 'project') args = ['new', ...args.slice(2)];\nif (args[0] === 'make' && args[1] === 'prototype')"))
edit('bin/adapters/project-create.ts',lambda s:s.replace('../guides/project-presets.json','../guides/legacy-project-presets.json').replace('../guides/project-prototype.json','../guides/legacy-project-prototype.json'))
edit('tests/tooling/interactive-maker-presets-domain.checks.mjs',lambda s:s.replace('bin/guides/project-presets.json','bin/guides/legacy-project-presets.json'))
edit('.github/workflows/project-presets.yml',lambda s:s.replace('name: Project preset qualification','name: Legacy project preset compatibility').replace('scripts/compiler/qualify-presets.mjs','scripts/compiler/qualify-legacy-presets.mjs'))
put('bin/adapters/legacy-project-command.ts', '''import type { Arguments, CommandContext } from './commands.ts';
import { option } from '../domain/command-options.ts';
import { requireSketch } from '../domain/errors.ts';
import { loadProjectCatalog, loadProjectGuide, projectInput, projectCreatePlan } from './project-create.ts';
import { applyPrepared } from './storage.ts';
/** Compatibility for reviewed PR43 requests; never silently rewrite their selected runtime. */
export async function legacyProjectCommand(args: Arguments, context: CommandContext, input: unknown): Promise<Record<string, unknown>> {
  const catalog = await loadProjectCatalog(), guide = await loadProjectGuide();
  if (args.action === 'validate') {
    requireSketch(!args.flags.apply && !args.flags.out, 'PROJECT_OPTION', 'Validation never writes; omit --apply and --out.');
    return projectInput(catalog, guide, input);
  }
  const plan = await projectCreatePlan({ ...context, catalog, guide, input, out: option(args, 'out', 'projects/prepared-project') });
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
''')
edit('bin/adapters/project-command.ts',lambda s:"import { legacyProjectCommand } from './legacy-project-command.ts';\n"+s.replace("  if (args.action === 'validate') {", "  if (data !== null && typeof data === 'object' && Object.hasOwn(data, 'prototypeRequest')) return legacyProjectCommand(args, context, data);\n  if (args.action === 'validate') {"))
edit('bin/adapters/commands.ts',lambda s:"import { loadProjectCatalog as loadLegacyCatalog, savedProjectSelection as savedLegacySelection, presetBoilerplatePlan } from './project-create.ts';\n"+s.replace("  const selected = await savedProjectSelection(context.root);", "  const selected = await savedProjectSelection(context.root);\n  const catalog = await loadLegacyCatalog(), legacy = await savedLegacySelection(context.root, catalog);\n  requireSketch(!selected || !legacy, 'PROJECT_CONFIG_CONFLICT', 'Both project.config.json and shell.project.json exist; reconcile the project selection before generating.');\n  if (legacy && !args.flags.kind) {\n    const plan = await presetBoilerplatePlan(context.root, context.frameworkRoot, option(args, 'out', `generated/${snapshot.document.project.id}`), snapshot.document, legacy, catalog, context.signal);\n    return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);\n  }"))
edit('bin/presentation/studio.ts',lambda s:"import { requireSketch } from '../domain/errors.ts';\nimport { loadProjectCatalog as loadLegacyCatalog, savedProjectSelection as savedLegacySelection, presetBoilerplatePlan } from '../adapters/project-create.ts';\n"+s.replace("  const selection = await savedProjectSelection(options.root);", "  const selection = await savedProjectSelection(options.root);\n  const catalog = await loadLegacyCatalog(), legacy = await savedLegacySelection(options.root, catalog);\n  requireSketch(!selection || !legacy, 'PROJECT_CONFIG_CONFLICT', 'Both project.config.json and shell.project.json exist; reconcile the project selection before generating.');\n  if (legacy) {\n    await review(ui, await presetBoilerplatePlan(options.root, options.frameworkRoot, out, workspace.document, legacy, catalog, options.signal), options.signal); return;\n  }"))
edit('tests/tooling/interactive-maker-presets-ui.checks.mjs',lambda s:s.replace("data.input.prototypeRequest.answers.approved", "data.input.interview.answers.approved").replace("data.input.frontend, 'nuxt-ui'", "data.input.preset, 'plugin-nuxtui'").replace("data.stages, ['preset', 'frontend', 'prototype', 'review', 'apply']", "data.flow, ['preset', 'framework', 'hybrid-targets-if-needed', 'prototype', 'agreement', 'plan-review', 'apply']"))
edit('bin/README.md',lambda s:s+'''\n## Integrated preset compatibility

`new` now discovers the eight named presets documented in [PROJECT-PRESETS.md](PROJECT-PRESETS.md). The earlier five-family `prototypeRequest`/`frontend` request format is still accepted by `new --input` and `new validate`; its historical reference is [LEGACY-PROJECT-PRESETS.md](LEGACY-PROJECT-PRESETS.md). Existing `shell.project.json` projects retain their original emitter during sketch regeneration. New projects use the strict `project.config.json` sidecar. A workspace containing both sidecars is rejected rather than silently choosing one. Both formats retain plan hashes and default-No writes.
''')
edit('bin/LEGACY-PROJECT-PRESETS.md',lambda s:'# Legacy PR43 request and project compatibility\n\nThis is the retained five-family reference. Default `new presets` and `new guide` now expose the eight-preset contract in [PROJECT-PRESETS.md](PROJECT-PRESETS.md); existing `prototypeRequest` inputs and `shell.project.json` projects remain supported.\n\n'+s)
edit('tests/tooling/interactive-maker-ui.checks.mjs',lambda s:s.replace("if (String(chunk).includes('Choose number or ID')) queueMicrotask(() => input.write(':back\\n'));", "if (String(chunk).includes('Project title')) queueMicrotask(() => input.end());"))
commit('fix: consolidate stacked preset implementations without losing legacy requests','567a16d52f4949e743f126d5e9b6047813508c91')
for name in ['scripts/companion/journey/project-store.ts','docs/concepts/companion/editor/workspace/use-workspace.ts','tests/tooling/companion-sitemap-project-store.checks.mjs']:
 edit(name,lambda s:s.replace('async import(', 'async importProject(').replace('.import(', '.importProject('))
edit('.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs',lambda s:s.replace('inlineDynamicImports: true','codeSplitting: false'))
edit('.claude/skills/companion-prototype-design/tests/integration.checks.mjs',lambda s:s.replace('config.build.rolldownOptions.output.inlineDynamicImports, true','config.build.rolldownOptions.output.codeSplitting, false'))
p=root/'.claude/skills/companion-prototype-design/PACKAGE-INVENTORY.json';j=json.loads(p.read_text())
for key in j:
 if isinstance(j[key],list):
  for f in j[key]:
   if isinstance(f,dict) and f.get('path') in ['scripts/lib/build-worker.mjs','tests/integration.checks.mjs']:
    b=(p.parent/f['path']).read_bytes();f['bytes']=len(b);f['sha256']=hashlib.sha256(b).hexdigest()
p.write_text(json.dumps(j,indent=2)+'\n')
commit('fix: keep Journey Lens imports compatible with guarded offline builds','2f14b9ef3082d7d4f1d6e880d14d6e14279f59e6')
print('CANDIDATE='+git('rev-parse','HEAD'))
print('PR43_RECONCILED='+git('rev-parse','reconcile43'))
