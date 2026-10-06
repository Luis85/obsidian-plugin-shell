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
export const entity = defineEntity("data-source",1,{"title": f0,
"source_kind": fields.optional(f1),
"locator": fields.optional(f2),
"credential_ref": fields.optional(f3)});
export const document = defineDocument(entity,{mappings:[{"field":"title","property":"title"},{"field":"source_kind","property":"source_kind"},{"field":"locator","property":"locator"},{"field":"credential_ref","property":"credential_ref"}],title: values => String(values.title ?? ''),body: values => '# ' + heading(String(values.title ?? '')) + '\n'});
export const feature = defineNoteFeature({document,defaultFolder:"Companion/DataSource"});
