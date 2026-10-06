import type { TerminalInput, TerminalOutput } from './session.ts';
export function useTerminal(mode: string, input: TerminalInput, output: TerminalOutput, env: Record<string, string | undefined>): boolean {
  if (mode === 'plain' || env.SHELL_ACCESSIBLE === '1' || env.TERM === 'dumb') return false;
  if (env.CI && env.CI !== 'false') return false;
  return Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
}
export function useColor(disabled: boolean, env: Record<string, string | undefined>): boolean {
  return !disabled && !env.NO_COLOR && !env.NODE_DISABLE_COLORS && env.FORCE_COLOR !== '0';
}
