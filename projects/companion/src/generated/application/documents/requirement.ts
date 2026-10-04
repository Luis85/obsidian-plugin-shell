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
function isF5(value: unknown): value is Array<string> { return matches(value,{"type":"array","items":{"type":"string"}}); }
const f5 = {required:true as const,kind:"list" as const,read(value:unknown) { return isF5(value) ? success(Object.freeze([...value])) : failure('validation','error.entity'); }};
export const entity = defineEntity("requirement",1,{"title": f0,
"acceptance": fields.optional(f1),
"priority": fields.optional(f2),
"status": fields.optional(f3),
"project_ref": fields.optional(f4),
"screen_refs": fields.optional(f5)});
export const document = defineDocument(entity,{mappings:[{"field":"title","property":"title"},{"field":"acceptance","property":"acceptance"},{"field":"priority","property":"priority"},{"field":"status","property":"status"},{"field":"project_ref","property":"project_ref"},{"field":"screen_refs","property":"screen_refs"}],title: values => String(values.title ?? ''),body: values => '# ' + heading(String(values.title ?? '')) + '\n'});
export const feature = defineNoteFeature({document,defaultFolder:"Companion/Requirement"});
