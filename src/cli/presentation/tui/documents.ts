import type { ReviewRequest } from './contracts.ts';
import { wrap } from './text.ts';
interface CachedDocument { body: string; width: number; lines: string[] }
// Retain only the current wrapped document per request. Weak keys release closed reviews.
const documents = new WeakMap<ReviewRequest, CachedDocument>();
export function documentLines(request: ReviewRequest, section: number, width: number): string[] {
  const body = request.sections[section]?.body ?? '', cached = documents.get(request);
  if (cached?.body === body && cached.width === width) return cached.lines;
  const lines = wrap(body, width); documents.set(request, { body, width, lines }); return lines;
}
