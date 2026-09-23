import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Vitest's JSON omits retry diagnostics. Preserve real public reporter results
 * alongside it so a per-test retry or repeat cannot disappear into final success. */
export default class EvidenceVitestReporter {
  async onTestRunEnd(modules, unhandledErrors, reason) {
    const cases = modules.flatMap(module => [...module.children.allTests()].map(test => {
      const names = [test.name]; let parent = test.parent;
      while (parent.type === 'suite') { names.unshift(parent.name); parent = parent.parent; }
      const diagnostic = test.diagnostic(); const result = test.result();
      return { file: module.moduleId, name: names.join(' '), status: result.state,
        retry: diagnostic?.retryCount ?? 0, repeat: diagnostic?.repeatCount ?? 0,
        flaky: diagnostic?.flaky ?? false, errors: (result.errors ?? []).map(error => ({ name: error.name, message: error.message })) };
    }));
    if (!process.env.SHELL_EVIDENCE_OUTPUT) throw new Error('EVIDENCE_REPORTER_OUTPUT');
    await writeFile(join(process.env.SHELL_EVIDENCE_OUTPUT, 'attempts.json'), JSON.stringify({ schemaVersion: 1, reason, unhandledErrors, cases }));
  }
}
