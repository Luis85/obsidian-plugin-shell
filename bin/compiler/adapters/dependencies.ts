import type { Artifact, CompilerDiagnostic } from '../domain/contracts.ts';
import { diagnostic, CompilerError } from '../domain/diagnostics.ts';

type Manifest = { dependencies?: Record<string,string>; devDependencies?: Record<string,string>; packages?: Record<string,{version?:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>}> };
/** Direct pins that the lock root or the installed lock entry does not record exactly. */
function unresolvedPins(pkg: Manifest, lock: Manifest): string[] {
  const root=lock.packages?.[''];
  const locked=(group: 'dependencies'|'devDependencies', name: string, pin: string) =>
    root?.[group]?.[name] === pin && lock.packages?.['node_modules/'+name]?.version === pin;
  const missing=(['dependencies','devDependencies'] as const).flatMap(group =>
    Object.entries(pkg[group] ?? {}).filter(([name,pin]) => !locked(group,name,pin)).map(([name,pin]) => name+'@'+pin));
  return root ? missing : [...missing,'lockfile root'];
}
/** Inspect exact direct pins and lock root entries; never installs or accesses a registry. */
export function dependencyReadiness(files: readonly Artifact[]): {ready:boolean;diagnostics:CompilerDiagnostic[]} {
  const read = (path:string): Manifest => {
    const source = files.find(file=>file.path===path)?.content;
    if (!source) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','Missing generated '+path));
    try { return JSON.parse(source) as Manifest; }
    catch(error) { throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','Invalid generated '+path),{cause:error}); }
  };
  const missing=unresolvedPins(read('package.json'), read('package-lock.json'));
  return { ready:missing.length===0,diagnostics:missing.length ? [diagnostic('COMPILER_DEPENDENCY_RESOLUTION_REQUIRED','emit',
    'Exact dependency resolution is required for: '+missing.sort().join(', '))] : [] };
}
