/** Small semver-range reading: enough to compare majors, never a full resolver. */
const comparator = /^(>=|<=|>|<|=|\^|~)?v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:[-+][0-9A-Za-z.-]*)?$/;

/** The leading major of a version or range such as `^17.3.1`, `~15.2` or `v20`; null for tags and protocols. */
export function majorOf(range: string | null | undefined): number | null {
  const match = /^[\s^~=<>v]*(\d+)/.exec(range ?? '');
  return match ? Number(match[1]) : null;
}
/** First complete version found in a range, for display; null when none is present. */
export function versionOf(range: string | null | undefined): string | null {
  const match = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(range ?? '');
  return match ? match[1]! : null;
}
type Rule = (major: number, value: number, bare: boolean, exact: boolean) => boolean;
/** `bare` is a major-only comparator (`>18`); `exact` has zero minor and patch parts. */
const rules: Readonly<Record<string, Rule>> = {
  '>=': (major, value) => major >= value,
  '>': (major, value, bare, exact) => exact && bare ? major > value : major >= value,
  '<=': (major, value) => major <= value,
  '<': (major, value, _bare, exact) => exact ? major < value : major <= value,
};
const sameMajor: Rule = (major, value) => major === value;
function admitsComparator(token: string, major: number): boolean | null {
  const match = comparator.exec(token);
  if (!match) return null;
  const first = match[2]!;
  if (/[xX*]/.test(first)) return true;
  const exact = Number(match[3] ?? 0) === 0 && Number(match[4] ?? 0) === 0;
  return (rules[match[1] ?? '='] ?? sameMajor)(major, Number(first), match[3] === undefined, exact);
}
function admitsAlternative(alternative: string, major: number): boolean | null {
  if (/\s-\s/.test(alternative)) return null;
  const tokens = alternative.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  let known = true;
  for (const token of tokens) {
    const verdict = admitsComparator(token, major);
    if (verdict === null) known = false;
    else if (!verdict) return false;
  }
  return known ? true : null;
}
/** Whether a semver range (for example an `engines.node` value) admits a major; null when it cannot be read. */
export function rangeAdmitsMajor(range: string | null | undefined, major: number): boolean | null {
  if (range === null || range === undefined) return null;
  const verdicts = range.split('||').map(alternative => admitsAlternative(alternative, major));
  if (verdicts.includes(true)) return true;
  return verdicts.includes(null) ? null : false;
}
