/** "Did you mean" support for mistyped commands, options and recipe IDs (https://clig.dev/#errors). */
/** Optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps. */
function editDistance(left: string, right: string): number {
  let before: number[] = [], previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) current[j] = Math.min(current[j]!, before[j - 2]! + 1);
    }
    before = previous; previous = current;
  }
  return previous[right.length]!;
}
/**
 * Candidates within a length-scaled edit distance, plus candidates that extend the input as a
 * whole-word prefix (`plan` → `plan apply`, `plan inspect`). Closest first, bounded, deterministic.
 */
export function suggestions(input: string, candidates: readonly string[], limit = 3): string[] {
  const typed = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!typed.length) return [];
  const scored: Array<[string, number]> = [];
  for (const candidate of new Set(candidates)) {
    const words = candidate.split(' ');
    const compared = typed.slice(0, words.length).join(' ');
    const threshold = Math.max(1, Math.min(3, Math.floor(compared.length / 3)));
    const distance = editDistance(compared, candidate);
    if (distance <= threshold && distance < candidate.length) scored.push([candidate, distance]);
    else if (words.length > 1 && words[0] === typed[0] && (typed.length === 1 || editDistance(typed[1]!, words[1]!) > threshold)) scored.push([candidate, 4]);
  }
  return scored.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).slice(0, limit).map(([candidate]) => candidate);
}
export function didYouMean(found: readonly string[], format: (value: string) => string = value => value): string {
  return found.length ? ` Did you mean ${found.map(format).join(' or ')}?` : '';
}
