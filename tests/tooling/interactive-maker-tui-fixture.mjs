import { PassThrough, Writable } from 'node:stream';
import assert from 'node:assert/strict';
import { TerminalSession } from '../../bin/presentation/tui/session.ts';
export function terminalFixture(options = {}) {
  const input = new PassThrough(); input.isTTY = true; input.isRaw = options.raw ?? false;
  const raw = []; input.setRawMode = mode => { raw.push(mode); input.isRaw = mode; };
  const chunks = []; const output = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  output.isTTY = true; output.columns = 110; output.rows = 30;
  const controller = new AbortController();
  const session = new TerminalSession({ input, output, signal: controller.signal, cancel: () => controller.abort(), color: options.color ?? false });
  const ui = { rich: session, ask: async () => { throw new Error('A TUI must not fall through to line prompts.'); }, write: text => session.write(text) };
  return { session, input, output, controller, raw, chunks, ui,
    send(text) { input.write(text); }, text() { return chunks.join(''); },
    async until(fragment, from = 0) {
      const started = Date.now();
      while (!chunks.slice(from).join('').includes(fragment) && Date.now() - started < 5000) await new Promise(resolve => setTimeout(resolve, 5));
      assert.ok(chunks.slice(from).join('').includes(fragment), `No terminal output: ${fragment}`);
    },
    close() { session.dispose(); input.destroy(); output.destroy(); },
  };
}
