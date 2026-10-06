import { stderr, stdout } from 'node:process';
import { formatDiagnostics } from '../../compiler/adapters/reporting.ts';
import type { CompilerDiagnostic } from '../../compiler/domain/contracts.ts';
import type { Result } from '../../../../scripts/contracts/result.ts';
import { starterText } from './starter-terminal.ts';
import { renderHuman } from './terminal-render.ts';
import { terminalStyle, runnable } from './terminal-style.ts';

export interface CliOutputStream {
  write(text: string): unknown;
  isTTY?: boolean;
}

export interface CliOutput {
  output: CliOutputStream;
  error: CliOutputStream;
  env?: Record<string, string | undefined>;
}

const processOutput: CliOutput = { output: stdout, error: stderr, env: process.env };

export function renderCliResult(value: Result, machine: boolean, io: CliOutput = processOutput): void {
  if (machine) {
    io.output.write(JSON.stringify(value) + '\n');
    return;
  }
  const starter = value.command === 'new' ? starterText(value) : null;
  const human = starter === null
    ? renderHuman(value, terminalStyle(io.output, io.env ?? process.env))
    : { text: starter, diagnosticsShown: false };
  io.output.write(human.text);
  if (human.diagnosticsShown) return;
  for (const diagnostic of value.diagnostics) io.error.write(diagnosticText(diagnostic));
}
/** Compiler diagnostics keep their rich format; operation diagnostics print code, message and a runnable next step. */
function diagnosticText(diagnostic: Result['diagnostics'][number]): string {
  if (diagnostic.severity && diagnostic.phase && diagnostic.help) return formatDiagnostics([diagnostic as CompilerDiagnostic]);
  return `${diagnostic.code}: ${diagnostic.message}${diagnostic.next ? '\nNext: ' + runnable(diagnostic.next) : ''}\n`;
}
