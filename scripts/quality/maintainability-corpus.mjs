import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../testing/source-inputs.mjs';
import { duplicationReport } from './maintainability-reports.mjs';

export const duplicateArguments = ['dupes', '--mode', 'mild', '--min-tokens', '50', '--min-lines', '5', '--threshold', '3', '--no-fragments'];
export async function measureCorpus(tool, stage, inputs, output, execute) {
  await mkdir(output, { recursive: true });
  const captured = new Map();
  for (const input of inputs) captured.set(input.staged, await readFile(join(stage, input.staged)));
  for (const input of inputs) await rm(join(stage, input.staged));
  const records = [];
  for (const input of inputs) {
    await writeFile(join(stage, input.staged), captured.get(input.staged));
    const run = await execute(tool, stage, duplicateArguments, join(output, input.staged));
    const measured = duplicationReport(run.report, [input]);
    records.push({ path: input.path, staged: input.staged, exit: run.exit, sha256: run.rawHash,
      files: measured.total_files, lines: measured.total_lines, tokens: measured.total_tokens });
    await rm(join(stage, input.staged));
  }
  return records;
}
export function assertCorpus(records, inputs, duplication) {
  if (!Array.isArray(records) || records.length !== inputs.length) throw new Error('METRIC_CORPUS_INPUTS');
  const total = { files: 0, lines: 0, tokens: 0 };
  records.forEach((record, index) => {
    const input = inputs[index];
    if (record.path !== input.path || record.staged !== input.staged || ![0, 1].includes(record.exit)) throw new Error('METRIC_CORPUS_INPUT');
    for (const metric of ['files', 'lines', 'tokens']) {
      if (!Number.isSafeInteger(record[metric]) || record[metric] < 0) throw new Error('METRIC_CORPUS_DATA');
      total[metric] += record[metric];
    }
    if (record.files > 1 || (record.files === 0 && (record.tokens !== 0 || record.lines !== 0))) throw new Error('METRIC_CORPUS_FILE');
  });
  if (total.files !== duplication.total_files || total.lines !== duplication.total_lines || total.tokens !== duplication.total_tokens) throw new Error('METRIC_CORPUS_DENOMINATOR');
}
export async function checkCorpus(output, records, inputs, duplication) {
  assertCorpus(records, inputs, duplication);
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index]; const record = records[index];
    const raw = await readFile(join(output, `${input.staged}.json`), 'utf8');
    if (sha256(raw) !== record.sha256) throw new Error('METRIC_CORPUS_HASH');
    const result = duplicationReport(JSON.parse(raw), [input]);
    if (record.files !== result.total_files || record.lines !== result.total_lines || record.tokens !== result.total_tokens) throw new Error('METRIC_CORPUS_REPORT');
  }
}
