import type { StorybookOptions } from '../../compiler/domain/contracts.ts';
import { requireThat, stringOption, type Values } from './contracts.ts';
/** Explicit on/off values work identically in legacy CLI, saved requests and the TypeScript API. */
export function storybookFlags(options: Values): StorybookOptions | undefined {
  const output: StorybookOptions = {};
  for (const [flag, key] of [['storybook', 'enabled'], ['storybook-stories', 'generateStories']] as const) {
    const value = stringOption(options, flag);
    requireThat(value === undefined || value === 'on' || value === 'off', 'STORYBOOK_OPTION_INVALID', '--' + flag + ' must be on or off.');
    if (value !== undefined) output[key] = value === 'on';
  }
  return Object.keys(output).length ? output : undefined;
}
