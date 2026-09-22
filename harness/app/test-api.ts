import type { Preferences } from '../../src/domain/preferences';
export interface HarnessApi {
  files(): Record<string, string>;
  faults: { code: string; operation: string }[];
  fault(kind: 'write' | 'open' | 'settings' | 'notice' | 'none'): void;
  mountSecond(): void;
  closeSecond(): void;
  resourceCount(): number;
  leafWidth(width?: number): void;
  setPreferences(patch: Partial<Preferences>): Promise<boolean>;
  toggleHeader(): Promise<boolean>;
  dispose(): void;
}
declare global { interface Window { __SHELL_TEST__: HarnessApi } }
