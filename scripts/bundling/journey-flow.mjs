import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const runtime = 'docs/concepts/companion/vendor/vue-flow-core.iife.js';
const stylesheet = 'docs/concepts/companion/vendor/vue-flow.scoped.css';
const expected = '92cd354fac92f7a998565c40d6e3b59d9031dfc56db4d393a524cdb57cf27edc';
/** Build-time module adaptation of the already reviewed runtime. No eval, duplicate Vue or window globals. */
export function journeyFlow(root = process.cwd()) {
  return {
    name: 'plugin-shell-journey-flow',
    resolveId(id) { if (id === 'virtual:journey-flow' || id === 'virtual:journey-flow.css') return '\0' + id; },
    load(id) {
      if (id === '\0virtual:journey-flow.css') {
        const css = readFileSync(resolve(root, stylesheet), 'utf8');
        if (createHash('sha256').update(css).digest('hex') !== '911368b9ce32dcf1cba5756dc2e57d231c288a7c3eebf9445727f25c13ea1a5a' || !css.includes('#vf-root .vue-flow__container')) throw Error('JOURNEY_FLOW_STYLES');
        return css.replaceAll('#vf-root', '.journey-lens-root');
      }
      if (id !== '\0virtual:journey-flow') return;
      const source = readFileSync(resolve(root, runtime), 'utf8');
      if (createHash('sha256').update(source).digest('hex') !== expected ||
        !source.startsWith('var VueFlowCore = function(exports, vue) {') || !source.trimEnd().endsWith('}({}, Vue);')) throw Error('JOURNEY_FLOW_RUNTIME_DRIFT');
      return "import * as Vue from 'vue';\n" + source + '\nexport default VueFlowCore;\n';
    },
  };
}
