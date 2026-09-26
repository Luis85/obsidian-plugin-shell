import { posix } from 'node:path';
export interface Entry { path: string; content: string; encoding?: 'base64'; ownership: 'managed' | 'extension' | 'framework' }
export type Add = (path: string, content: string, ownership?: Entry['ownership']) => void;
export function relativeImport(from: string, to: string): string { const path = posix.relative(posix.dirname(from),to); return path.startsWith('.') ? path : './'+path; }
