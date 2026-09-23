import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { inspectPresentation } from '../../scripts/quality/check-presentation.mjs';

test('[PRESENTATION-03-01] minimal typed bindings pass while imperative SFC behavior fails', () => {
  const path = 'src/presentation/components/Example.vue';
  const sfc = script => `<script setup lang="ts">${script}</script><template><button>Example</button></template>`;
  assert.deepEqual(inspectPresentation(path, sfc("import { useExample } from '../composables/use-example'; const props = defineProps<{ onSelect?: (event: MouseEvent) => void }>(); const { value, save } = useExample();")), []);
  for (const script of ['async function save() { await Promise.resolve(); }', 'const save = () => commit();', 'for (const item of items) save(item);', 'onMounted(() => load());', 'let pending = false;', 'const stop = watch(source, callback);', 'if (ready) save();']) assert.ok(inspectPresentation(path, sfc(script)).length, script);
  assert.ok(inspectPresentation('src/presentation/Loose.vue', sfc('const props = defineProps();')).includes('VUE_COMPONENT_LOCATION'));
  assert.ok(inspectPresentation('src/presentation/components/model.ts', 'export const model = 1;').includes('TYPESCRIPT_CONCERN_LOCATION'));
});
test('[PRESENTATION-03-02] the real CLI rejects component imports from state and imperative Vue scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'presentation-concern-'));
  try {
    await mkdir(join(root, 'src/presentation/components'), { recursive: true });
    await mkdir(join(root, 'src/presentation/composables'), { recursive: true });
    const script = resolve('scripts/quality/check-presentation.mjs');
    const execute = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', timeout: 15000 });
    await writeFile(join(root, 'src/presentation/components/Example.vue'), '<script setup lang="ts">const props = defineProps<{ title: string }>();</script><template><h1>{{ props.title }}</h1></template>');
    await writeFile(join(root, 'src/presentation/composables/use-example.ts'), 'export function useExample() { return { value: 1 }; }');
    const pass = execute(); assert.equal(pass.status, 0, pass.stderr);
    for (const code of ["import Example from '../components/Example.vue';", "export { default } from '../components/Example.vue';", "const Example = import('../components/Example.vue');"]) {
      await writeFile(join(root, 'src/presentation/composables/use-example.ts'), code);
      const failed = execute(); assert.equal(failed.status, 1); assert.match(failed.stderr, /TYPESCRIPT_IMPORTS_COMPONENT/);
    }
    await writeFile(join(root, 'src/presentation/composables/use-example.ts'), 'export const value = 1;');
    await writeFile(join(root, 'src/presentation/components/Example.vue'), '<script setup lang="ts">function save() { localStorage.setItem("x", "y"); }</script><template><button @click="save">Save</button></template>');
    const failed = execute(); assert.equal(failed.status, 1); assert.match(failed.stderr, /BEHAVIOR_BELONGS_IN_TYPESCRIPT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
