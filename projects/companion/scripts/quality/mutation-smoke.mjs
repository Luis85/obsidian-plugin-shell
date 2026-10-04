import { build } from 'vite';
import fc from 'fast-check';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Bounded guard qualification, not a whole-program mutation score or Vue runner.
const path = resolve('src/domain/entity.ts');
const original = await readFile(path, 'utf8');
const mutants = [
  { id: 'unknown-field-guard', from: 'Object.keys(input).some(name => !Object.hasOwn(captured, name))', to: 'false' },
  { id: 'gregorian-century-guard', from: 'year % 400 === 0', to: 'false' },
  { id: 'finite-number-guard', from: 'Number.isFinite(value)', to: 'true' },
];
const options = { seed: 23092026, numRuns: 100 };
const results = [];
async function load(mutant) {
  let transformed = false;
  const output = await build({ configFile: false, envFile: false, logLevel: 'silent',
    plugins: [{ name: 'bounded-source-mutation', enforce: 'pre', transform(code, id) {
      if (resolve(id) !== path || !mutant) return;
      if (code.split(mutant.from).length !== 2) throw new Error(`MUTATION_ANCHOR_CHANGED: ${mutant.id}`);
      transformed = true; return code.replace(mutant.from, mutant.to);
    } }],
    build: { write: false, minify: false, target: 'es2022', lib: { entry: path, formats: ['es'], fileName: 'guard-probe' } },
  });
  if (mutant && !transformed) throw new Error('MUTATION_NOT_EXECUTED');
  const chunks = (Array.isArray(output) ? output : [output]).flatMap(bundle => bundle.output).filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].imports.length) throw new Error('MUTATION_UNEXPECTED_OUTPUT');
  return import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
}
function properties(module) {
  const schema = module.defineEntity('guard-probe', 1, { title: module.fields.text(), amount: module.fields.number() });
  fc.assert(fc.property(fc.string(), title => !schema.decode({ title, amount: 1, unexpected: true }).ok), options);
  fc.assert(fc.property(fc.constantFrom(1600, 2000, 2400), year => module.isCalendarDate(`${year}-02-29`)), options);
  // Explicit infinite bounds isolate the finite predicate from the default min/max bounds.
  const finite = module.fields.number({ min: -Infinity, max: Infinity });
  fc.assert(fc.property(fc.constantFrom(Infinity, -Infinity, NaN), value => !finite.read(value).ok), options);
}
properties(await load());
for (const mutant of mutants) {
  const module = await load(mutant);
  let killed = false; let detail;
  try { properties(module); } catch (error) { killed = true; detail = String(error.message).slice(0, 1200); }
  results.push({ id: mutant.id, status: killed ? 'killed' : 'survived', ...(detail ? { replay: detail } : {}) });
}
await mkdir('reports/mutation', { recursive: true });
const report = { mode: 'targeted-domain-guard-mutation', source: 'src/domain/entity.ts', sourceSha256: createHash('sha256').update(original).digest('hex'), options, baseline: 'passed', results };
await writeFile('reports/mutation/result.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!results.length || results.some(result => result.status !== 'killed')) process.exitCode = 1;
