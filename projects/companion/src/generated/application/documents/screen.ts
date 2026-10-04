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
export const entity = defineEntity("screen",1,{"title": f0,
"code_name": fields.optional(f1),
"layout": fields.optional(f2),
"surface_kind": fields.optional(f3),
"project_ref": fields.optional(f4),
"component_refs": fields.optional(f5)});
export const document = defineDocument(entity,{mappings:[{"field":"title","property":"title"},{"field":"code_name","property":"code_name"},{"field":"layout","property":"layout"},{"field":"surface_kind","property":"surface_kind"},{"field":"project_ref","property":"project_ref"},{"field":"component_refs","property":"component_refs"}],title: values => String(values.title ?? ''),body: values => '# ' + heading(String(values.title ?? '')) + '\n'});
export const feature = defineNoteFeature({document,defaultFolder:"Companion/Screen"});
