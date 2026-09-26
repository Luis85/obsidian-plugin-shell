import { posix } from 'node:path';
export interface Entry { path: string; content: string; encoding?: 'base64'; ownership: 'managed' | 'extension' | 'framework' }
export type Add = (path: string, content: string, ownership?: Entry['ownership']) => void;
/** Vue component files need multi-word names (vue/multi-word-component-names): a single-word name gets its role as suffix. */
export function componentFile(name: string, role: 'screen' | 'component'): string { return name.includes('-') ? name : `${name}-${role}`; }
export function relativeImport(from: string, to: string): string { const path = posix.relative(posix.dirname(from),to); return path.startsWith('.') ? path : './'+path; }
