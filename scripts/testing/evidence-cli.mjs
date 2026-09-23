import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runEvidence } from './evidence-runner.mjs';
import { checkEvidence, checkSession } from './evidence-validation.mjs';
import { acceptanceReport } from './evidence-acceptance.mjs';

export async function evidenceCli(args) {
  if (args.length === 1 && ['--help', 'help'].includes(args[0])) {
    console.log('Evidence: run <runtime|browser|tooling|coverage|artifact|native> [--root DIR]\n  run native --allow-download [--candidate ROOT_CONTAINED_DIRECTORY]\n  check PACKET [--root DIR]\n  report SESSION_DIRECTORY [--root DIR]\nRuns retain every attempt in reports/evidence/<input-digest>. Report reconciles the entire session; failed or missing attempts block every claim. Check/report never execute producers. Native requires provisioned isolated host tooling, an exact retained candidate and explicit --allow-download. No command grants release authority.');
    return 0;
  }
  const [action, target, ...flags] = args;
  let root = process.cwd(); let allowDownload = false; let candidate; let rootSeen = false;
  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] === '--root' && flags[index + 1] && !rootSeen) { root = resolve(flags[++index]); rootSeen = true; }
    else if (flags[index] === '--allow-download' && action === 'run' && target === 'native' && !allowDownload) allowDownload = true;
    else if (flags[index] === '--candidate' && action === 'run' && target === 'native' && !candidate && flags[index + 1]) candidate = flags[++index];
    else throw new Error('EVIDENCE_ARGUMENT');
  }
  if (!target) throw new Error('EVIDENCE_ARGUMENT');
  if (action === 'run') {
    const result = await runEvidence(root, target, { allowDownload, candidate });
    console.log(JSON.stringify({ path: result.path, status: result.packet.status, failure: result.packet.failure, counts: result.packet.result?.counts }, null, 2));
    return result.packet.status === 'passed' ? 0 : 1;
  }
  if (action === 'check') {
    const packet = await checkEvidence(root, resolve(target));
    console.log(JSON.stringify({ id: packet.id, producer: packet.producer, status: packet.status, scope: 'one execution; use report for complete session acceptance' }, null, 2));
    return 0;
  }
  if (action === 'report') {
    const result = await acceptanceReport(root, await checkSession(root, resolve(target)));
    console.log(JSON.stringify(result, null, 2)); return result.status === 'passed' ? 0 : 1;
  }
  throw new Error('EVIDENCE_ARGUMENT');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await evidenceCli(process.argv.slice(2)); }
  catch (error) { console.error(JSON.stringify({ status: 'infrastructure-error', error: error.message })); process.exitCode = 2; }
}
