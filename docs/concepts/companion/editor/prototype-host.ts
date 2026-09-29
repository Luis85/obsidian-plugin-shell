import type { AuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import type { PrototypeSelection, PrototypeWorkspace } from '../../../../scripts/companion/prototypes/model.ts';
export interface PrototypeHost {
  read(): { workspace: PrototypeWorkspace; working: AuthoringDocument; opened: PrototypeSelection | null; writable: boolean };
  save(workspace: PrototypeWorkspace, expectedKey: string): void;
  open(selection: PrototypeSelection, expectedKey: string): void;
  confirm(message: string): boolean;
  exportWorkspace(format: 'json' | 'directory'): Promise<void>;
  exportActive(): void;
  importWorkspace(text: string, expectedKey: string): void;
}
export type PrototypeForm = '' | 'create' | 'fork' | 'version' | 'details';
