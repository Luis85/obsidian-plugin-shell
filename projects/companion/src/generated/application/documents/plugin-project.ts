import { defineEntity, fields } from "../../../domain/entity.ts";
import { matches } from '../../domain/contract.ts';
import { success, failure } from "../../../domain/outcome.ts";
import { defineDocument, heading } from "../../../application/document-definition.ts";
import { defineNoteFeature } from "../../../application/note-feature.ts";
function isF0(value: unknown): value is string { return matches(value,{"type":"string"}); }
const f0 = {required:true as const,kind:"text" as const,read(value:unknown) { return isF0(value) ? success(value) : failure('validation','error.entity'); }};
function isF1(value: unknown): value is string { return matches(value,{"type":"string"}); }
const f1 = {required:true as const,kind:"text" as const,read(value:unknown) { return isF1(value) ? success(value) : failure('validation','error.entity'); }};
function isF2(value: unknown): value is string { return matches(value,{"type":"string"}); }
const f2 = {required:true as const,kind:"text" as const,read(value:unknown) { return isF2(value) ? success(value) : failure('validation','error.entity'); }};
function isF3(value: unknown): value is string { return matches(value,{"type":"string"}); }
const f3 = {required:true as const,kind:"text" as const,read(value:unknown) { return isF3(value) ? success(value) : failure('validation','error.entity'); }};
function isF4(value: unknown): value is string { return matches(value,{"type":"string"}); }
const f4 = {required:true as const,kind:"text" as const,read(value:unknown) { return isF4(value) ? success(value) : failure('validation','error.entity'); }};
export const entity = defineEntity("plugin-project",1,{"plugin_id": fields.optional(f0),
"title": f1,
"description": fields.optional(f2),
"codebase_folder": fields.optional(f3),
"tests_folder": fields.optional(f4)});
export const document = defineDocument(entity,{mappings:[{"field":"plugin_id","property":"plugin_id"},{"field":"title","property":"title"},{"field":"description","property":"description"},{"field":"codebase_folder","property":"codebase_folder"},{"field":"tests_folder","property":"tests_folder"}],title: values => String(values.title ?? ''),body: values => '# ' + heading(String(values.title ?? '')) + '\n'});
export const feature = defineNoteFeature({document,defaultFolder:"Companion/PluginProject"});
