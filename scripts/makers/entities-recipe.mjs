import { templates } from './templates.mjs';
import { symbol, title } from './arguments.mjs';
import { readRegistry, extendRegistry, validateRegistrySource } from './registry.mjs';
import { generatedTest } from './primitives.mjs';

export async function registerEntity(context, { key, local, from }) {
  await context.edit('src/bootstrap/features.ts', async source => {
    const registry = await readRegistry(context.root, source);
    const next = extendRegistry(registry, { key, local, from });
    await validateRegistrySource(next); return next;
  });
}
export async function entityRecipe(context, { owner, entity, folder, preset, backend }) {
  const generated = templates({ owner, entity, folder, preset });
  if (backend === 'markdown') {
    for (const entry of generated.entries) await context.add(entry.path, entry.content);
    context.tests.add(generated.test);
    await registerEntity(context, { key: generated.name, local: generated.feature, from: `../features/${owner}/${entity}.definition` });
    return generated;
  }
  await context.add(generated.entries[0].path, generated.entries[0].content);
  const key = symbol(entity); const sample = `Example ${title(entity)}`; const label = preset === 'project' ? 'name' : 'title';
  if (backend === 'domain') {
    await context.editArray('src/bootstrap/authoring-domains.ts', 'authoringDomains', `${key}Entity`, [{ local: `${key}Entity`, from: `../features/${owner}/${entity}.entity` }]);
    await generatedTest(context, owner, entity, 'domain', `import { expect, it } from 'vitest';\nimport { ${key}Entity } from '../../../src/features/${owner}/${entity}.entity';\n\nit('validates ${entity} without a document or persistence', () => {\n  expect(${key}Entity.decode({ ${label}: '' }).ok).toBe(false);\n  expect(${key}Entity.decode(null).ok).toBe(false);\n  const parsed = ${key}Entity.parse({ ${label}: '  ${sample}  ' });\n  expect(parsed.ok).toBe(true);\n  if (!parsed.ok) throw new Error('expected valid entity');\n  expect(parsed.value.${label}).toBe('  ${sample}  ');\n});\n`);
  } else {
    await context.add(generated.definition, `import { definePluginDataFeature } from '../api';\nimport { ${key}Entity } from './${entity}.entity';\n\nexport const ${key}Feature = definePluginDataFeature({ backend: 'plugin-data', entity: ${key}Entity });\n`);
    await registerEntity(context, { key, local: `${key}Feature`, from: `../features/${owner}/${entity}.definition` });
    await generatedTest(context, owner, entity, 'plugin-data', `import { expect, it } from 'vitest';\nimport { PluginDataRepository } from '../../../src/application/plugin-data-repository';\nimport { ${key}Entity } from '../../../src/features/${owner}/${entity}.entity';\nimport { authoringFixture } from '../authoring-fixture';\n\nit('persists ${entity} through real plugin-data CRUD and rejects stale writes', async () => {\n  const f = await authoringFixture();\n  const repository = new PluginDataRepository(${key}Entity, f.data, f.services.events, () => 'fixture-id', () => '2026-09-23T00:00:00.000Z', f.services.diagnostics);\n  try {\n    expect((await repository.create({ ${label}: '' })).ok).toBe(false);\n    expect(f.saved).toHaveLength(0);\n    const created = await repository.create({ ${label}: '${sample}' });\n    if (!created.ok) throw new Error('create failed');\n    expect((await repository.get(created.value.id)).ok).toBe(true);\n    const updated = await repository.update(created.value, { ...created.value.values, ${label}: 'Changed' });\n    if (!updated.ok) throw new Error('update failed');\n    expect((await repository.update(created.value, created.value.values)).ok).toBe(false);\n    expect((await repository.delete(updated.value)).ok).toBe(true);\n    const remaining = await repository.list(); expect(remaining).toEqual({ ok: true, value: [] });\n  } finally { repository.dispose(); f.dispose(); }\n});\n`);
  }
  return generated;
}
