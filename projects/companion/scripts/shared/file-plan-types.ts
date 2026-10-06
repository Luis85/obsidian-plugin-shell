export type FilePlanEncoding = 'base64';
export type FilePlanStatus = 'unchanged' | 'create' | 'delete' | 'update';

export interface FilePlanEntry {
  path: string;
  content: string | null;
  encoding?: FilePlanEncoding;
}

export interface FilePlanChange extends FilePlanEntry {
  beforeHash: string | null;
  afterHash: string | null;
  status: FilePlanStatus;
}

export interface FilePlan {
  version: 1;
  root: string;
  changes: readonly Readonly<FilePlanChange>[];
}

export interface ApplyFilePlanReport {
  status: 'applied' | 'failed';
  written: string[];
  unchanged: string[];
  rolledBack: string[];
  preserved: string[];
  remaining: string[];
  recoveryPath?: string;
}

export interface ApplyFilePlanOptions {
  beforeWrite?: (change: Readonly<FilePlanChange>, index: number) => void | Promise<void>;
}
