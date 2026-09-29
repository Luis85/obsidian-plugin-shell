import { nativeTextIssue, type NativeFileType } from '../domain/native-file';
/** One draft per file view. Parsing never reformats the original bytes. */
export class NativeFileDraft {
  private accepted = '';
  private persisted = '';
  private text = '';
  private conflict = false;
  private uncertain = false;
  constructor(private readonly type: NativeFileType) {}
  get content(): string { return this.accepted; }
  get draft(): string { return this.text; }
  get dirty(): boolean { return this.text !== this.persisted; }
  get blocked(): boolean { return this.conflict || this.uncertain; }
  get issue(): string | null {
    if (this.uncertain) return 'Save failed or was interrupted. Copy your draft, then reopen the file to verify its contents.';
    if (this.conflict) return 'The file changed outside this draft. Copy your draft before discarding it to load the incoming version.';
    return nativeTextIssue(this.text,this.type);
  }
  load(content: string, clear = false): void {
    if (!clear && this.dirty && content !== this.accepted) {
      this.accepted = content; this.persisted = content; this.conflict = true; return;
    }
    if (clear || content !== this.accepted || !this.dirty) {
      this.accepted = content; this.persisted = content; this.text = content; this.conflict = false; this.uncertain = false;
    }
  }
  edit(text: string): void { this.text = text; }
  accept(): boolean {
    if (this.issue) return false;
    this.accepted = this.text; return true;
  }
  saved(content: string): void { if (content === this.accepted) this.persisted = content; }
  failed(): void { this.uncertain = true; }
  discard(): void {
    // An uncertain write must be verified by reopening; do not silently authorize a retry.
    if (this.uncertain) return;
    this.text = this.accepted; this.conflict = false;
  }
}
