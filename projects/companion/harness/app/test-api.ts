import type { Preferences } from '../../src/domain/preferences';
export type HarnessFault = 'write' | 'write-pause' | 'open' | 'open-pause' | 'settings' | 'settings-pause' | 'notice' | 'none';
export interface HarnessApi {
  files(): Record<string, string>;
  faults: { code: string; operation: string }[];
  fault(kind: HarnessFault): void;
  mountSecond(): void;
  closeSecond(): void;
  resourceCount(): number;
  resources(): { timers: number; dialogs: number; notices: number; actions: number; openDialogs: number; openCalls: number; subscriptions: number; leaves: number };
  leafWidth(width?: number): void;
  setPreferences(patch: Partial<Preferences>): Promise<boolean>;
  toggleHeader(): Promise<boolean>;
  dispose(): void;
}
declare global { interface Window { __SHELL_TEST__: HarnessApi } }
