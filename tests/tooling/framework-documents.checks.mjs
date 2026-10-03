import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebaseMarkdown } from '../../bin/compiler/emitters/framework-docs.ts';

// Consumer docs retain useful prose without acquiring a separate concept's executable payload.
test('[GENERATOR-DEVKIT-09] links to explicitly excluded concepts become named reference boundaries', () => {
  const source = '[Jev Studio](docs/concepts/jev-prompt-editor/README.md) and [Guide](docs/development/FRAMEWORK-CLI.md).\n'
    + '```md\n[Jev example](docs/concepts/jev-prompt-editor/README.md)\n```\n'
    + '[Similar](docs/concepts/jev-prompt-editor-example/README.md)';
  const actual = rebaseMarkdown(source, 'SHELL-FIRST-OVERVIEW.md', 'docs/framework/SHELL-FIRST-OVERVIEW.md');
  assert.match(actual, /^Jev Studio \(maintainer-only asset, not included\) and \[Guide\]\(\.\.\/development\/FRAMEWORK-CLI\.md\)/);
  assert.match(actual, /```md\n\[Jev example\]\(docs\/concepts\/jev-prompt-editor\/README.md\)\n```/);
  assert.match(actual, /\[Similar\]\(\.\.\/concepts\/jev-prompt-editor-example\/README.md\)/);
});
