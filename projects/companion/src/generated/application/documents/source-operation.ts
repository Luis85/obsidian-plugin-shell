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
export const entity = defineEntity("source-operation",1,{"title": f0,
"direction": fields.optional(f1),
"input_shape": fields.optional(f2),
"output_shape": fields.optional(f3),
"source_ref": fields.optional(f4)});
export const document = defineDocument(entity,{mappings:[{"field":"title","property":"title"},{"field":"direction","property":"direction"},{"field":"input_shape","property":"input_shape"},{"field":"output_shape","property":"output_shape"},{"field":"source_ref","property":"source_ref"}],title: values => String(values.title ?? ''),body: values => '# ' + heading(String(values.title ?? '')) + '\n'});
export const feature = defineNoteFeature({document,defaultFolder:"Companion/SourceOperation"});
