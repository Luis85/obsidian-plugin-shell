/** Presentation-only requests. Business operations and persisted JSON remain outside the renderer. */
export interface Item { id: string; label: string; description?: string }
export interface Section { title: string; body: string }
export interface Context { title: string; location: string; details: string[]; dirty?: boolean }
export interface TextRequest {
  kind: 'text'; title: string; initial: string; multiline?: boolean; help?: string;
  validate?: (value: string) => string | undefined;
}
export interface SelectRequest { kind: 'select' | 'multi'; title: string; items: Item[]; initial?: string; help?: string }
export interface ReviewRequest { kind: 'review'; title: string; sections: Section[] }
export type Request = TextRequest | SelectRequest | ReviewRequest;
export type Reply = { kind: 'answer'; value: string | string[] } | { kind: 'back' } | { kind: 'cancel' };
export interface RichPrompts {
  text(request: Omit<TextRequest, 'kind'>): Promise<string>;
  select(title: string, items: Item[], initial?: string): Promise<string>;
  multi(title: string, items: Item[]): Promise<string[]>;
  review(title: string, sections: Section[]): Promise<void>;
  context(value: Context): void;
  busy(label: string): void;
}
export interface Key { name?: string; sequence?: string; ctrl?: boolean; meta?: boolean; shift?: boolean }
export interface State {
  request: Request; value: string; cursor: number; query: string; searching: boolean;
  index: number; checked: string[]; section: number; offset: number; help: boolean; error: string;
}
