import recipes from '../../../scripts/makers/recipes.json' with { type: 'json' };
import { flagOptions, valueOptions, type FlagOption, type MakerArguments, type MakerOptions, type ValueOption } from './contracts.ts';

const flags = new Set<string>(flagOptions);
const values = new Set<string>(valueOptions);
const isFlag = (arg: string): arg is FlagOption => flags.has(arg);
const isValue = (arg: string): arg is ValueOption => values.has(arg);
const defaultOptions = ['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list', '--feature'];
export const builtinRecipes: readonly string[] = Object.freeze(recipes.map(recipe => recipe.id));
export function recipeOptions(maker: string): readonly string[] {
  return recipes.find(recipe => recipe.id === maker)?.options ?? defaultOptions;
}
function readOption(args: readonly string[], index: number, options: MakerOptions): number {
  const arg = args[index] ?? '';
  if (!isFlag(arg) && !isValue(arg)) throw new Error(`Unknown maker option: ${arg}`);
  if (Object.hasOwn(options, arg)) throw new Error(`Repeated maker option: ${arg}`);
  if (isFlag(arg)) { options[arg] = true; return index; }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
  options[arg] = value;
  return index + 1;
}
export function parseArguments(args: readonly string[]): MakerArguments {
  const options: MakerOptions = {}; const positional: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg.startsWith('--')) index = readOption(args, index, options);
    else positional.push(arg);
  }
  if (positional.length > 2) throw new Error('Expected a maker and one name');
  return { maker: positional[0], name: positional[1], options };
}
const reservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9]|constructor|prototype|default|class|function|var|let|const|export|import)$/i;
export function slug(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) || value.length > 48 || reservedName.test(value)) throw new Error(`Invalid ${label}: use a lowercase non-reserved hyphenated name`);
  return value;
}
export const makerSymbol = (value: string): string => value.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
export const title = (value: string): string => value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
