import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { brainstormWizard } from '../../bin/presentation/brainstorm.ts';
import { brainstormVerifyPlan } from '../../bin/adapters/brainstorm.ts';
import { brainstormScratch, scriptedRich, scriptedPlain, quickNote, fakeNpm, pinnedFramework, readScratchJson, readText }
  from './interactive-maker-brainstorm-fixture.mjs';

const sourceCompletion = 'Brainstorm saved to brainstorms/quick-note. Concept: docs/concepts/brainstorms/quick-note.json. ' +
  'The canonical project was not changed; import remains a separate reviewed action. Generated source is under brainstorms/quick-note/source/.\n';

test('generated prototype source offers a separately reviewed run that starts only after its own approval', { timeout: 300000 }, async () =>
  brainstormScratch(async options => {
    const npm = await fakeNpm(options.root);
    // The generating template pins the running Node, so the approved run executes on every toolchain row.
    const pinned = { ...options, frameworkRoot: await pinnedFramework(options.root) };
    try {
      const answers = run => quickNote({ 'What should be prepared?': ['prototype'],
        'After generation, what should be available as a separately approved run?': ['test'],
        'Run the reviewed install/test plan?': [run] });
      const declined = scriptedRich(answers('no'));
      assert.equal(await brainstormWizard(declined.ui, pinned), sourceCompletion);
      assert.deepEqual(declined.left(), []);
      assert.deepEqual(await npm.calls(), [], 'file-plan approval never authorizes processes');
      const execution = declined.reviews.find(item => item.title === 'Review generated-source execution');
      assert.match(execution.sections[0].body, /^npm ci --no-fund\nnpm run test\n\nExecution plan hash: [a-f0-9]{64}$/);
      assert.match(execution.sections[1].body, /npm ci downloads and executes dependency lifecycle scripts/);
      assert.deepEqual(JSON.parse(execution.sections[2].body), { expected: { node: process.versions.node, npm: '11.19.1' },
        actual: { node: process.versions.node, npm: '11.19.1' } });
      const definition = await readScratchJson(options.root, 'brainstorms/quick-note/feature.definition.json');
      assert.deepEqual([definition.feature.output, definition.feature.verification, definition.generatedSource.path],
        ['prototype', 'test', 'brainstorms/quick-note/source']);
      assert.equal(declined.contexts.at(-1).details[0], '8 / 8');

      const approved = scriptedRich(answers('yes'));
      assert.equal(await brainstormWizard(approved.ui, pinned), sourceCompletion);
      assert.ok(approved.writes.includes('No changes needed. Files already match.\n'), 'the identical package is not rewritten');
      assert.ok(approved.writes.includes('Generated-source verification completed: install, test. Native acceptance and publication were not inferred.\n'));
      assert.ok(approved.events.some(event => event[0] === 'busy' && /separately approved generated-source checks/.test(event[1])));
      assert.deepEqual((await npm.calls()).map(call => call.args.join(' ')), ['ci --no-fund', 'run test']);
    } finally { npm.restore(); }
  }));

test('a mismatched toolchain blocks the reviewed run before asking for process approval', { timeout: 300000 }, async () =>
  brainstormScratch(async options => {
    const npm = await fakeNpm(options.root, { version: '10.0.0' });
    try {
      const f = scriptedPlain(['', 'Quick note', 'Capture a note', '', '', 'Notes', 'Write notes', '', '', '', '3', '3', 'y', 'y']);
      assert.equal(await brainstormWizard(f.ui, options), sourceCompletion);
      assert.equal(f.left(), 0);
      assert.equal(f.questions.at(-1), 'Apply this reviewed plan? (y/N): ', 'no process confirmation is offered while blocked');
      const output = f.output();
      assert.ok(output.includes('\nAfter generation, what should be available as a separately approved run?\n  1. Do not run anything\n'));
      // The generated pin is the qualified Node; another running Node adds its own blocker before npm's.
      const pin = (await readText(options.root, 'brainstorms/quick-note/source/.nvmrc')).trim(), running = process.versions.node;
      const blockers = [...(pin === running ? [] : ['Select Node ' + pin + '; found ' + running]), 'Select npm 11.19.1; found 10.0.0'];
      const plan = await brainstormVerifyPlan(options, 'brainstorms/quick-note');
      assert.deepEqual(plan.blockers, blockers);
      assert.equal(output.slice(output.indexOf('\nGenerated-source execution plan\n')), '\nGenerated-source execution plan\n' +
        'npm ci --no-fund\nnpm run test\nnpm run build\nPlan hash: ' + plan.planHash + '\n\nBLOCKED:\n' + blockers.join('\n') + '\n' +
        'No process started. Switch to the generated project toolchain and run brainstorm verify again.\n' + sourceCompletion);
      assert.deepEqual(await npm.calls(), []);
      const definition = await readScratchJson(options.root, 'brainstorms/quick-note/feature.definition.json');
      assert.deepEqual([definition.feature.output, definition.feature.verification], ['boilerplate', 'test-build']);
    } finally { npm.restore(); }
  }));
