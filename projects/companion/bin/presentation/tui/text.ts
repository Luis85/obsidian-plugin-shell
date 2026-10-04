import { stripVTControlCharacters } from 'node:util';
import { hasControls } from '../../domain/errors.ts';
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
export function graphemes(value: string): string[] {
  return Array.from(segmenter.segment(value), item => item.segment);
}
/** No user text can emit terminal commands, OSC clipboard changes or bidi overrides. */
export function clean(value: string): string {
  return [...stripVTControlCharacters(value)].filter(character => {
    const code = character.codePointAt(0)!;
    const bidi = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
    return !bidi && !hasControls(character, true);
  }).join('').replace(/\t/g, '  ').replace(/\r\n?/g, '\n');
}
function cellWidth(cluster: string): number {
  if (/^\p{Mark}+$/u.test(cluster)) return 0;
  if (/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(cluster)) return 2;
  const code = cluster.codePointAt(0)!;
  const wide = [[0x1100, 0x115f], [0x2329, 0x232a], [0x2e80, 0xa4cf], [0xac00, 0xd7a3],
    [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff01, 0xff60], [0xffe0, 0xffe6], [0x20000, 0x3fffd]];
  return wide.some(([start, end]) => code >= start! && code <= end!) ? 2 : 1;
}
export function cells(value: string): number { return graphemes(value).reduce((sum, cluster) => sum + cellWidth(cluster), 0); }
export function clip(value: string, width: number): string {
  let result = '', used = 0;
  for (const cluster of graphemes(clean(value).replace(/\n/g, ' '))) {
    used += cellWidth(cluster); if (used > width) break;
    result += cluster;
  }
  return result;
}
export function fit(value: string, width: number): string {
  const clipped = clip(value, width); return clipped + ' '.repeat(Math.max(0, width - cells(clipped)));
}
/** Cell-aware hard wrapping preserves every character and line; long identifiers remain inspectable. */
export function wrap(value: string, width: number): string[] {
  const result: string[] = [];
  for (const line of clean(value).split('\n')) {
    let current = '', used = 0;
    for (const cluster of graphemes(line)) {
      const size = cellWidth(cluster);
      if (used + size > Math.max(2, width)) { result.push(current); current = ''; used = 0; }
      current += cluster; used += size;
    }
    result.push(current);
  }
  return result;
}
