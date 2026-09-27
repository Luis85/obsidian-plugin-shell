import type { Artifact, CompilerDiagnostic } from '../domain/contracts.ts';
import { diagnostic, CompilerError } from '../domain/diagnostics.ts';

type Manifest = { dependencies?: Record<string,string>; devDependencies?: Record<string,string>; packages?: Record<string,{version?:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>}> };
/** Inspect exact direct pins and lock root entries; never installs or accesses a registry. */
export function dependencyReadiness(files: readonly Artifact[]): {ready:boolean;diagnostics:CompilerDiagnostic[]} {
  const read = (path:string): Manifest => {
    const source = files.find(file=>file.path===path)?.content;
    if (!source) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','Missing generated '+path));
    try { return JSON.parse(source) as Manifest; }
    catch(error) { throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','Invalid generated '+path),{cause:error}); }
  };
  const pkg=read('package.json'), lock=read('package-lock.json'), root=lock.packages?.[''];
  const missing: string[]=[];
  for (const group of ['dependencies','devDependencies'] as const) {
    for (const [name,pin] of Object.entries(pkg[group] ?? {})) {
      if (root?.[group]?.[name] !== pin || lock.packages?.['node_modules/'+name]?.version !== pin) missing.push(name+'@'+pin);
    }
  }
  if (!root) missing.push('lockfile root');
  return { ready:missing.length===0,diagnostics:missing.length ? [diagnostic('COMPILER_DEPENDENCY_RESOLUTION_REQUIRED','emit',
    'Exact dependency resolution is required for: '+missing.sort().join(', '))] : [] };
}
