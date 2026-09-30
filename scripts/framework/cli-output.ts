import { stderr, stdout } from 'node:process';
import { formatDiagnostics } from '../compiler/adapters/reporting.ts';
import type { CompilerDiagnostic } from '../compiler/domain/contracts.ts';
import type { Result } from './contracts.ts';
import { starterText } from './starter-terminal.ts';
import { renderHuman } from './terminal-render.ts';
import { terminalStyle, runnable } from './terminal-style.ts';

export function renderCliResult(value: Result, machine: boolean): void {
  if (machine) { stdout.write(JSON.stringify(value) + '\n'); return; }
  const starter = value.command === 'new' ? starterText(value) : null;
  const human = starter === null ? renderHuman(value, terminalStyle(stdout)) : { text: starter, diagnosticsShown: false };
  stdout.write(human.text);
  if (human.diagnosticsShown) return;
  for (const diagnostic of value.diagnostics) {
    if (diagnostic.severity && diagnostic.phase && diagnostic.help) {
      stderr.write(formatDiagnostics([diagnostic as CompilerDiagnostic]));
      continue;
    }
    stderr.write(`${diagnostic.code}: ${diagnostic.message}${diagnostic.next ? '\nNext: ' + runnable(diagnostic.next) : ''}\n`);
  }
}
