import { join } from 'node:path';
import { exists, readJson, readBounded } from './files.ts';
import { status } from '../../../scripts/framework/inspection.ts';
import { result, requireThat, type Context, type Result } from './contracts.ts';

const safeCodes = new Set(['CONFIG_MISSING', 'IDENTITY_DRIFT', 'DEPENDENCIES_MISSING', 'NODE_UNSUPPORTED',
  'NODE_UNQUALIFIED', 'DESIGN_GENERATION_STALE', 'ACCEPTANCE_PENDING']);
function own(object: unknown, key: string): unknown {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return undefined;
  const property = Object.getOwnPropertyDescriptor(object, key);
  return property && 'value' in property ? property.value : undefined;
}

/** Allowlist projection, not a regex scrubber. Authored fields, messages, paths and raw causes never enter the report. */
export function supportSnapshot(observation: Result) {
  const data = own(observation, 'data');
  const boolean = (key: string) => { const value = own(data, key);
    requireThat(typeof value === 'boolean', 'SUPPORT_SHAPE', 'Unsupported observation shape.'); return value; };
  const count = own(data, 'acceptanceObligations'), stale = own(data, 'designStale');
  requireThat(count === null || (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && count <= 100000), 'SUPPORT_SHAPE', 'Unsupported obligation count.');
  requireThat(stale === null || typeof stale === 'boolean', 'SUPPORT_SHAPE', 'Unsupported freshness observation.');
  const diagnostics = own(observation, 'diagnostics');
  requireThat(Array.isArray(diagnostics) && diagnostics.length <= 100, 'SUPPORT_SHAPE', 'Unsupported diagnostic collection.');
  const codes = new Set<string>();
  for (let index = 0; index < diagnostics.length; index++) {
    const entry = Object.getOwnPropertyDescriptor(diagnostics, String(index));
    requireThat(entry && 'value' in entry, 'SUPPORT_SHAPE', 'Unsupported diagnostic entry.');
    const code = own(entry.value, 'code'); codes.add(typeof code === 'string' && safeCodes.has(code) ? code : 'OTHER');
  }
  return { kind: 'shell-support-report', schemaVersion: 1,
    observations: { generated: boolean('generated'), imported: boolean('imported'), dependenciesPresent: boolean('dependencies'),
      designStale: stale, acceptanceObligations: count }, diagnosticCodes: [...codes].sort(),
    runtime: { node: process.versions.node, platform: process.platform, architecture: process.arch },
    native: 'not-tested-by-report', qualification: 'not-inferred', publication: 'not-authorized',
    privacy: { authoredContent: false, identities: false, paths: false, hashes: false, rawErrors: false, network: false },
    written: [], next: 'Review locally before sharing. Resolve uncertain writes before any retry.' };
}

export async function supportReport(context: Context) {
  try {
    requireThat(!context.signal?.aborted,'CANCELLED','Report cancelled.');
    const report=supportSnapshot(await status(context,'doctor'));
    requireThat(!context.signal?.aborted,'CANCELLED','Report cancelled.');
    const kit=await exists(join(context.frameworkRoot,'.framework/kit.json'));
    const metadata=await readJson(join(context.frameworkRoot,kit?'.framework/kit.json':'package.json'));
    const version=own(metadata,'version');
    requireThat(typeof version==='string' && /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(version),'SUPPORT_SHAPE','Unsupported version.');
    const selected=await exists(join(context.frameworkRoot,'.nvmrc'))?(await readBounded(join(context.frameworkRoot,'.nvmrc'),100)).toString('utf8').trim():null;
    requireThat(selected===null || /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(selected),'SUPPORT_SHAPE','Unsupported toolchain.');
    requireThat(!context.signal?.aborted,'CANCELLED','Report cancelled.');
    return result('support report',{...report,framework:{version,distribution:kit?'compiled-kit':'source',selectedNode:selected}});
  }
  catch { return unavailableSupport(context.signal?.aborted === true); }
}

/** Also used before collection starts, when CLI parsing or root discovery fails. */
export function unavailableSupport(cancelled = false): Result {
  return { ...result('support report', null, cancelled ? 'cancelled' : 'blocked'), diagnostics: [{
    code: cancelled ? 'CANCELLED' : 'SUPPORT_UNAVAILABLE',
    message: 'The report could not be collected. Inspect the local project without sharing raw logs; no files were changed.',
  }] };
}
