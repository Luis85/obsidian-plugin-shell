/** How a workflow `shell:` value maps to a local interpreter invocation, mirroring the hosted-runner defaults. */
export interface ShellInvocation { file: string; args: string[]; display: string }
const powershellGuard = (script: string): string =>
  `$ErrorActionPreference = 'stop'\n${script}\nif ((Test-Path -LiteralPath variable:\\LASTEXITCODE)) { exit $LASTEXITCODE }`;
/** `explicit` is false for the runner default (`bash -e`); a named `bash` also enables pipefail. Unknown shells return null. */
export function shellInvocation(shell: string, explicit: boolean, script: string): ShellInvocation | null {
  if (shell === 'bash') {
    const flags = explicit ? ['--noprofile', '--norc', '-eo', 'pipefail'] : ['-e'];
    return { file: 'bash', args: [...flags, '-c', script], display: `bash ${flags.join(' ')}` };
  }
  if (shell === 'sh') return { file: 'sh', args: ['-e', '-c', script], display: 'sh -e' };
  if (shell === 'pwsh' || shell === 'powershell') {
    return { file: 'pwsh', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', powershellGuard(script)], display: 'pwsh -command' };
  }
  return shell === 'python' ? { file: 'python3', args: ['-c', script], display: 'python3 -c' } : null;
}
/**
 * Parses the `GITHUB_ENV` / `GITHUB_OUTPUT` file format: `name=value` lines and `name<<DELIMITER` blocks.
 * Malformed lines are ignored, like the runner does for lines without `=`.
 */
export function parseCommandFile(text: string): Record<string, string> {
  const values: Record<string, string> = {}, lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!, block = /^([^=<]+)<<(.+)$/.exec(line);
    if (block) {
      const end = lines.indexOf(block[2]!, index + 1);
      if (end < 0) break;
      values[block[1]!] = lines.slice(index + 1, end).join('\n');
      index = end;
    } else if (line.includes('=')) values[line.slice(0, line.indexOf('='))] = line.slice(line.indexOf('=') + 1);
  }
  return values;
}
