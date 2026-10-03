const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { dataCode } from '../../scripts/companion/compiler/data-code.ts';
import { typeCode, sample, sampleCode } from '../../scripts/companion/compiler/schema-code.ts';
import { noteWireSchemas, validateNoteWire } from '../../scripts/companion/compiler/note-contracts.ts';
import { dataDocument, starterDocument, model, recorder } from './compiler-emitters-fixture.mjs';

// Source/entity emission (data-code.ts) and the schema/wire helpers it shares (schema-code.ts, note-contracts.ts).
const emitData = async document => { const out = recorder(); dataCode(model(document ?? await dataDocument()), out.add); return out; };

test('data emission writes entity, contract, service, adapter, store, test and design files per source', async () => {
  const out = await emitData();
  const app = 'src/generated/application/', source = slug => [`${app}${slug}/contracts.ts`, `${app}${slug}/service.ts`, `src/generated/infrastructure/sources/${slug}.ts`,
    `src/generated/presentation/stores/${slug}.ts`, `tests/project/sources/${slug}.test.ts`, `design/sources/${slug}.json`];
  const requirements = ['req-4216938b1425', 'req-300aff4335cc', 'req-0513070d46bd', 'req-01d57c9fdd4b', 'req-57f947f394a7'];
  assert.deepEqual([...out.files.keys()], ['src/generated/domain/entities/starter-task.ts', 'tests/project/entities/starter-task.test.ts',
    'src/generated/domain/entities/starter-project.ts', 'tests/project/entities/starter-project.test.ts', ...source('starter-records'), ...source('task-notes'), ...source('status-api'),
    `${app}sources.ts`, 'src/generated/bootstrap/sources.ts', ...requirements.flatMap(key => [`${app}use-cases/${key}.ts`, `tests/project/acceptance/${key}.test.ts`])]);
  assert.deepEqual([...out.files].filter(([, entry]) => entry.ownership === 'managed').map(([path]) => path),
    ['design/sources/starter-records.json', 'design/sources/task-notes.json', 'design/sources/status-api.json', `${app}sources.ts`, 'src/generated/bootstrap/sources.ts']);
  assert.equal(out.text('tests/project/entities/starter-task.test.ts'), `import { it, expect } from 'vitest';
import { isGStarterTask } from "../../../src/generated/domain/entities/starter-task.ts";
it("starter-task validates its declared fields", () => { expect(isGStarterTask({"id":"fixture","type":"starter-task","title":"fixture"})).toBe(true); expect(isGStarterTask(null)).toBe(false); expect(isGStarterTask({})).toBe(false); });
`);
  const entity = out.text('src/generated/domain/entities/starter-task.ts').split('\n');
  assert.equal(entity[1], 'export type GStarterTask = { "id": string; "type": "starter-task"; "title": string; "status"?: string; "due_date"?: string; "project_ref"?: string; "parent_ref"?: string; };');
  assert.equal(entity.at(-2), 'export const definition = {"id":"er-entity-1","slug":"starter-task","name":"Task","folder":"Starter/Task"};');
  const contracts = out.text(`${app}starter-records/contracts.ts`).split('\n');
  assert.deepEqual([contracts[1], contracts[7], contracts[8], ...contracts.slice(-5)], ['export type GListRecordsInput = undefined;',
    'export type GArchiveInput = { "id": string; "tags"?: Array<string>; };',
    'export const GArchiveInputSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}}},"required":["id"],"additionalProperties":true};',
    'export interface GStarterRecordsPort {', '  "list-records"(input: GListRecordsInput, signal?: AbortSignal): Promise<unknown>;', '  "archive"(input: GArchiveInput, signal?: AbortSignal): Promise<unknown>;', '}', '']);
  assert.equal(out.text(`${app}status-api/service.ts`).split('\n')[0],
    "import { type GStatusInput, type GStatusOutput, isGStatusInput, isGStatusOutput, type GPingInput, type GPingOutput, isGPingInput, isGPingOutput, type GStatusApiPort } from './contracts.ts';");
  assert.equal(out.text('src/generated/presentation/stores/status-api.ts'), `import { defineStore } from 'pinia';
import { operation } from '../composables/operation.ts';
import type { GStatusApiService } from '../../application/status-api/service.ts';
export function defineGStatusApiStore(service: GStatusApiService) {
  return defineStore("tasks-projects-plugin:source:status-api", () => ({
    "status": operation(service["status"],"read"),
    "ping": operation(service["ping"],"write"),
  }));
}
`);
  const sourceTest = out.text('tests/project/sources/status-api.test.ts');
  assert.ok(sourceTest.includes('const fixture = (): GStatusApiPort => ({"status": async () => ({"status":"ready"}),\n"ping": async () => (undefined)});\n'));
  assert.ok(sourceTest.includes('    expect((await state["ping"].execute({"count":1})).ok).toBe(false);\n'));
  assert.deepEqual(JSON.parse(out.text('design/sources/status-api.json')).operations.map(op => op.id), ['ds-operation-31', 'ds-operation-32']);
});

test('adapters declare only the parameters their generated bodies read', async () => {
  const out = await emitData();
  assert.equal(out.text('src/generated/infrastructure/sources/starter-records.ts'), `import type { GStarterRecordsPort } from '../../application/starter-records/contracts.ts';
import type { Services } from "../../../bootstrap/services.ts";
import { NotImplementedError } from '../../domain/contract.ts';

import type { RelationshipSession } from '../../application/relationship-session.ts';



/** Native mappings use the shell's canonical repositories; other adapters remain explicit. */
export const createGStarterRecordsAdapter: (shell: Services, integrity: RelationshipSession) => GStarterRecordsPort = (_shell) => {


  return {
    async "list-records"(_input, signal) { if(signal?.aborted) throw new Error('OPERATION_ABORTED'); const result=await _shell.repositories.GStarterTask.list(); if(!result.ok) throw new Error('NOTE_READ_FAILED'); return result.value.map(snapshot=>({...snapshot.values,id:snapshot.id,type:"starter-task"})); },
    async "archive"() { throw new NotImplementedError("ds-source-1","ds-operation-9"); },
  };
};
`);
  assert.equal(out.text('src/generated/infrastructure/sources/task-notes.ts'), `import type { GTaskNotesPort } from '../../application/task-notes/contracts.ts';
import type { Services } from "../../../bootstrap/services.ts";

import { noteOperations } from '../../application/note-operations.ts';
import type { RelationshipSession } from '../../application/relationship-session.ts';
import { protectNoteRelationships } from '../../application/relationship-session.ts';

import { entity as GStarterTaskEntity } from '../../application/documents/starter-task.ts';
/** Native mappings use the shell's canonical repositories; other adapters remain explicit. */
export const createGTaskNotesAdapter: (shell: Services, integrity: RelationshipSession) => GTaskNotesPort = (_shell, integrity) => {
  const GStarterTaskNotes = noteOperations(protectNoteRelationships(_shell.repositories.GStarterTask, integrity),"starter-task",input => { const result=GStarterTaskEntity.decode(input); if(!result.ok) throw new Error('NOTE_VALUES_INVALID'); return result.value; });

  return {
    "list-tasks": GStarterTaskNotes.list,
    "create-tasks": GStarterTaskNotes.create,
    "update-tasks": GStarterTaskNotes.update,
    "delete-tasks": GStarterTaskNotes.delete,
  };
};
`);
  assert.equal(out.text('src/generated/infrastructure/sources/status-api.ts'), `import type { GStatusApiPort } from '../../application/status-api/contracts.ts';
import type { Services } from "../../../bootstrap/services.ts";


import type { RelationshipSession } from '../../application/relationship-session.ts';

import { createGStatusApiHttpProvider } from './status-api-http.ts';

/** Native mappings use the shell's canonical repositories; other adapters remain explicit. */
export const createGStatusApiAdapter: (shell: Services, integrity: RelationshipSession) => GStatusApiPort = () => {

  const http=createGStatusApiHttpProvider();
  return {
    "status": http.port["status"],
    "ping": http.port["ping"],
  };
};
`);
});

test('the source registry and bootstrap compose every source with the shared relationship integrity', async () => {
  const out = await emitData();
  assert.equal(out.text('src/generated/application/sources.ts'), `import type { GStarterRecordsService } from './starter-records/service.ts';
import type { GTaskNotesService } from './task-notes/service.ts';
import type { GStatusApiService } from './status-api/service.ts';
import type { GStarterRecordsPort } from './starter-records/contracts.ts';
import type { GTaskNotesPort } from './task-notes/contracts.ts';
import type { GStatusApiPort } from './status-api/contracts.ts';
export interface Sources { "starter-records": GStarterRecordsService;
"task-notes": GTaskNotesService;
"status-api": GStatusApiService; }
export interface SourcePorts { "starter-records": GStarterRecordsPort;
"task-notes": GTaskNotesPort;
"status-api": GStatusApiPort; }
`);
  const bootstrap = out.text('src/generated/bootstrap/sources.ts').split('\n');
  assert.deepEqual(bootstrap.slice(6, 14), ["import { createRelationshipIntegrity } from './relationships.ts';", 'import type { Services } from "../../bootstrap/services.ts";',
    "import type { Sources, SourcePorts } from '../application/sources.ts';", "import { validateSourceOverrides } from '../application/source-overrides.ts';",
    'export function createSources(shell: Services, overrides: Partial<SourcePorts> = {}): Sources {',
    ' validateSourceOverrides(overrides,{"starter-records":["list-records","archive"],"task-notes":["list-tasks","create-tasks","update-tasks","delete-tasks"],"status-api":["status","ping"]});',
    ' const integrity=createRelationshipIntegrity(shell);', ' return {"starter-records": createGStarterRecordsService(overrides["starter-records"] ?? createGStarterRecordsAdapter(shell, integrity)),']);
  assert.equal(out.text('src/generated/application/use-cases/req-01d57c9fdd4b.ts').split('\n').at(-3), '  throw new NotImplementedError("starter-requirements","starter-4");');
  assert.match(out.text('tests/project/acceptance/req-01d57c9fdd4b.test.ts'), /^import \{ it \} from 'vitest';\n\/\/ Implement a failing behavioral assertion against application\/use-cases\/req-01d57c9fdd4b\.ts first\.\n[^\n]+\nit\.todo\("\[starter-4\] [^\n]+"\);\n$/);
});

test('a project without sources or relationships emits empty registries and no integrity session', async () => {
  const document = await starterDocument('blank'); document.design.prds = [];
  const out = await emitData(document);
  assert.deepEqual([...out.files.keys()], ['src/generated/application/sources.ts', 'src/generated/bootstrap/sources.ts']);
  assert.equal(out.text('src/generated/application/sources.ts'), '\n\nexport type Sources = Record<string, never>;\nexport type SourcePorts = Record<string, never>;\n');
  assert.equal(out.text('src/generated/bootstrap/sources.ts'), `

import type { Services } from "../../bootstrap/services.ts";
import type { Sources, SourcePorts } from '../application/sources.ts';
import { validateSourceOverrides } from '../application/source-overrides.ts';
export function createSources(shell: Services, overrides: Partial<SourcePorts> = {}): Sources {
 validateSourceOverrides(overrides,{});
${' '}
 return {}; }
`);
});

test('schema types and samples cover every supported JSON Schema form', () => {
  assert.equal(typeCode(null), 'undefined'); assert.equal(sampleCode(null), 'undefined'); assert.equal(sample(null), undefined);
  assert.equal(typeCode({ type: 'string', enum: ['a', '<b>'] }), '"a" | "\\u003cb\\u003e"');
  assert.equal(typeCode({ type: ['string', 'null', 'integer'] }), 'string | null | number');
  assert.equal(typeCode({ type: 'object', properties: { a: { type: 'number' }, b: { type: 'array', items: { type: 'boolean' } } }, required: ['a'] }),
    '{ "a": number; "b"?: Array<boolean>; }');
  assert.equal(typeCode({ type: 'object' }), '{  }');
  assert.deepEqual(sample({ type: ['null', 'string'] }), null);
  assert.deepEqual(sample({ type: 'object', properties: { a: { type: 'integer' }, b: { type: 'boolean' }, c: { type: 'number' } }, required: ['a', 'b'] }), { a: 1, b: false });
  assert.deepEqual(sample({ type: 'object' }), {});
  assert.deepEqual(sample({ type: 'array', items: { type: 'string', enum: ['first', 'second'] } }), ['first']);
  assert.deepEqual(['date', 'date-time', 'uuid', 'email', 'uri', 'other', undefined].map(format => sample({ type: 'string', format })),
    ['2026-01-01', '2026-01-01T00:00:00.000Z', '00000000-0000-4000-8000-000000000001', 'fixture@example.invalid', 'https://example.invalid/fixture', 'fixture', 'fixture']);
  assert.equal(sampleCode({ type: 'object', properties: { tag: { type: 'string', enum: ['</script>'] } }, required: ['tag'] }), '{"tag":"\\u003c/script\\u003e"}');
});

test('native note wire contracts are exact per operation and refuse drift', async () => {
  const m = model(await dataDocument()), entity = m.entities[0];
  const values = { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string' }, due_date: { type: 'string', format: 'date' }, project_ref: { type: 'string' }, parent_ref: { type: 'string' } },
    required: ['title'], additionalProperties: false };
  const snapshot = { type: 'object', properties: { record: entity.schema, revision: { type: 'integer' } }, required: ['record', 'revision'], additionalProperties: false };
  const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  assert.deepEqual(noteWireSchemas(entity, 'list'), { input: null, output: { type: 'array', items: snapshot } });
  assert.deepEqual(noteWireSchemas(entity, 'create'), { input: object({ values, requestId: { type: 'string' } }), output: snapshot });
  assert.deepEqual(noteWireSchemas(entity, 'update'), { input: object({ id: { type: 'string' }, revision: { type: 'integer' }, values }), output: snapshot });
  assert.deepEqual(noteWireSchemas(entity, 'delete'), { input: object({ id: { type: 'string' }, revision: { type: 'integer' } }), output: null });
  assert.throws(() => noteWireSchemas(entity, 'purge'), { message: 'GENERATOR_INVALID: Unknown native note operation.' });
  assert.deepEqual(noteWireSchemas({ ...entity, schema: { type: 'object' } }, 'create').input.properties.values, { type: 'object', properties: {}, required: [], additionalProperties: false });
  const operations = m.sources.find(source => source.slug === 'task-notes').operations;
  for (const [index, kind] of ['list', 'create', 'update', 'delete'].entries()) validateNoteWire(entity, operations[index], kind);
  validateNoteWire(entity, { ...operations[1], direction: 'both', input: { ...operations[1].input, required: [...operations[1].input.required].reverse() } }, 'create');
  assert.throws(() => validateNoteWire(entity, { ...operations[0], direction: 'write' }, 'list'), { message: 'GENERATOR_INVALID: Native note operation direction mismatch.' });
  assert.throws(() => validateNoteWire(entity, { ...operations[3], output: snapshot }, 'delete'),
    { message: 'GENERATOR_INVALID: Native note operation requires its exact values/snapshot wire contract.' });
});
