/** Generator CLI adapter: the read-only plan by default, --apply only for a freshly rebuilt reviewed hash. */
import { storybookFlags } from '../../framework/storybook-options.ts';
import { planProject, applyProject, reviewProject } from './project-plan.ts';
export async function generatorCli(args: string[]) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) {
    process.stdout.write('Usage: node bin/app generate --input <project.json> --vault <vault> --target <relative-folder> [--apply <reviewed-plan-hash>] [--output-kind obsidian-plugin|clickdummy] [--storybook-stories on|off] [--storybook on|off]\nDefault: read-only JSON file plan. --apply must match a freshly rebuilt plan. No install/build/publish side effects.\n'); return;
  }
  const options: Record<string,string> = {};
  for (let index=0;index<args.length;index+=2) {
    const key = args[index]!.slice(2); const value = args[index+1];
    if (!['input','vault','target','apply','output-kind','storybook','storybook-stories'].includes(key) || args[index] !== '--'+key || Object.hasOwn(options,key) || !value || value.startsWith('--')) throw new Error('GENERATOR_USAGE: invalid or repeated option.');
    options[key] = value;
  }
  if (!options.input || !options.target) throw new Error('GENERATOR_USAGE: --input and --target are required.');
  if (options['output-kind'] && !['obsidian-plugin','clickdummy'].includes(options['output-kind'])) throw new Error('GENERATOR_USAGE: invalid output kind.');
  const result = await planProject({input:options.input,target:options.target,vault:options.vault,storybook:storybookFlags(options),outputKind:options['output-kind'] as 'obsidian-plugin'|'clickdummy'|undefined});
  const review = reviewProject(result);
  if (options.apply) { const applied = await applyProject(result,options.apply); process.stdout.write(JSON.stringify({...review,mode:'applied',applied},null,2)+'\n'); }
  else { process.stdout.write(JSON.stringify(review,null,2)+'\n'); if (result.conflicts.length) process.exitCode = 2; }
}
