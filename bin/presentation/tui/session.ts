import { emitKeypressEvents } from 'node:readline';
import { PassThrough, type Readable, type Writable } from 'node:stream';
import { requireSketch, SketchError } from '../../domain/errors.ts';
import { Back } from '../prompts.ts';
import type { Context, Key, Reply, Request, RichPrompts, Section, State, TextRequest, Item } from './contracts.ts';
import { initialState, step, paste } from './state.ts';
import { frame, dimensions } from './frame.ts';
import { clean } from './text.ts';
export interface TerminalInput extends Readable { isTTY?: boolean; isRaw?: boolean; setRawMode?: (mode: boolean) => unknown }
export interface TerminalOutput extends Writable { isTTY?: boolean; columns?: number; rows?: number }
interface SessionOptions { input: TerminalInput; output: TerminalOutput; signal: AbortSignal; cancel: () => void; color: boolean }
const enter = '\x1b[?1049h\x1b[?25l\x1b[?2004h';
const leave = '\x1b[?2004l\x1b[?25h\x1b[0m\x1b[?1049l';
/** Owns terminal state only. No file IO, globals, generator logic or timers live here. */
export class TerminalSession implements RichPrompts {
  private readonly options: SessionOptions;
  private readonly decoder = new PassThrough();
  private readonly wasRaw: boolean;
  private readonly wasFlowing: boolean;
  private state: State | null = null;
  private current: Context = { title: 'Your next idea', location: 'Workspace', details: ['Pages', 'Components', 'Prototype guide', '', 'F1 Keyboard help'] };
  private notice = '';
  private previous: string[] = [];
  private started = false;
  private ended = false;
  private blocked = false;
  private pending?: { accept: (value: string | string[]) => void; reject: (error: Error) => void };
  private pasteBuffer: string | null = null;
  constructor(options: SessionOptions) {
    this.options = options; this.wasRaw = Boolean(options.input.isRaw); this.wasFlowing = options.input.readableFlowing === true;
  }
  start(): void {
    requireSketch(!this.started && !this.ended, 'TUI_LIFECYCLE', 'Terminal session cannot be restarted.');
    requireSketch(!this.options.signal.aborted, 'CANCELLED', 'Cancelled before opening the terminal.');
    this.started = true;
    const { input, output, signal } = this.options;
    emitKeypressEvents(this.decoder); this.decoder.on('keypress', this.key);
    input.on('data', this.data); input.on('end', this.closed); input.on('close', this.closed); input.on('error', this.failed);
    output.on('resize', this.resize); output.on('error', this.failed); output.on('drain', this.drained);
    signal.addEventListener('abort', this.cancelled, { once: true });
    try { input.setRawMode?.(true); input.resume(); output.write(enter); this.draw(); }
    catch (error) { this.dispose(); throw error; }
  }
  context(value: Context): void { this.current = value; this.draw(); }
  busy(label: string): void { this.notice = clean(label); this.draw(); }
  write(text: string): void {
    const lines = clean(text).trim().split('\n'); this.notice = lines.at(-1)?.slice(0, 300) ?? ''; this.draw();
  }
  text(request: Omit<TextRequest, 'kind'>): Promise<string> { return this.single({ kind: 'text', ...request }); }
  select(title: string, items: Item[], initial?: string): Promise<string> { return this.single({ kind: 'select', title, items, initial }); }
  async multi(title: string, items: Item[]): Promise<string[]> {
    const value = await this.request({ kind: 'multi', title, items });
    requireSketch(Array.isArray(value), 'TUI_REPLY', 'Expected a component selection.'); return value;
  }
  async review(title: string, sections: Section[]): Promise<void> {
    requireSketch(sections.length > 0, 'TUI_REVIEW', 'A review needs at least one document.');
    await this.request({ kind: 'review', title, sections });
  }
  private async single(request: Request): Promise<string> {
    const value = await this.request(request); requireSketch(typeof value === 'string', 'TUI_REPLY', 'Expected one answer.'); return value;
  }
  private request(request: Request): Promise<string | string[]> {
    requireSketch(!this.ended && !this.options.signal.aborted, 'CANCELLED', 'Terminal session closed.');
    requireSketch(!this.pending, 'TUI_CONCURRENT_PROMPT', 'Only one prompt can own keyboard focus.');
    this.state = initialState(request);
    return new Promise((accept, reject) => { this.pending = { accept, reject }; this.draw(); });
  }
  private complete(reply: Reply): void {
    const pending = this.pending; this.pending = undefined; this.state = null;
    if (reply.kind === 'cancel') { this.options.cancel(); pending?.reject(new SketchError('CANCELLED', 'Session cancelled. Unsaved edits were not written.')); }
    else if (reply.kind === 'back') pending?.reject(new Back());
    else pending?.accept(reply.value);
  }
  private key = (text: string | undefined, key: Key): void => {
    if (this.ended) return;
    if (key.name === 'paste-start') { this.pasteBuffer = ''; return; }
    if (key.name === 'paste-end') { this.finishPaste(); return; }
    if (this.pasteBuffer !== null) { this.pasteBuffer = (this.pasteBuffer + (key.sequence ?? text ?? '')).slice(0, 10001); return; }
    if (key.ctrl && key.name === 'c') { this.complete({ kind: 'cancel' }); return; }
    if (!this.state) return;
    const size = dimensions(this.options.output.columns, this.options.output.rows);
    if (size.width < 59 || size.height < 18) return;
    const reply = step(this.state, key, text, size.bodyHeight - 1, size.contentWidth);
    if (reply) this.complete(reply);
    this.draw();
  };
  private finishPaste(): void {
    if (this.pasteBuffer !== null && this.state) paste(this.state, this.pasteBuffer);
    this.pasteBuffer = null; this.draw();
  }
  private data = (chunk: Buffer | string): void => {
    try { this.decoder.write(chunk); } catch (error) { this.failed(error instanceof Error ? error : new Error('Terminal input failed.')); }
  };
  private resize = (): void => { this.previous = []; this.draw(); };
  private drained = (): void => { this.blocked = false; this.draw(); };
  private closed = (): void => { this.options.cancel(); this.cancelled(); };
  private failed = (error: Error): void => {
    this.pending?.reject(error); this.pending = undefined; this.options.cancel(); this.dispose();
  };
  private cancelled = (): void => {
    this.pending?.reject(new SketchError('CANCELLED', 'Session cancelled. Saved files are unchanged; unsaved edits are discarded.'));
    this.pending = undefined; this.dispose();
  };
  private draw(): void {
    if (!this.started || this.ended || this.blocked) return;
    const next = frame(this.state, this.current, this.notice, dimensions(this.options.output.columns, this.options.output.rows), this.options.color);
    const changes = next.flatMap((line, row) => this.previous[row] === line ? [] : [`\x1b[${row + 1};1H\x1b[2K${line}`]);
    this.previous = next;
    if (changes.length) this.blocked = !this.options.output.write(changes.join(''));
  }
  private restoreOutput(): void {
    const { output } = this.options;
    const released = () => { output.removeListener('error', this.failed); };
    if (!this.started || output.destroyed) { released(); return; }
    try { output.write(leave, released); } catch (error) { released(); throw error; }
  }
  dispose(): void {
    if (this.ended) return; this.ended = true;
    const { input, output, signal } = this.options;
    input.removeListener('data', this.data); input.removeListener('end', this.closed); input.removeListener('close', this.closed); input.removeListener('error', this.failed);
    output.removeListener('resize', this.resize); output.removeListener('drain', this.drained);
    signal.removeEventListener('abort', this.cancelled);
    this.decoder.removeListener('keypress', this.key); this.decoder.destroy();
    this.pending?.reject(new SketchError('CANCELLED', 'Terminal session closed.')); this.pending = undefined;
    try { if (this.started) input.setRawMode?.(this.wasRaw); } finally {
      if (!this.wasFlowing) input.pause();
      this.restoreOutput();
    }
  }
}
