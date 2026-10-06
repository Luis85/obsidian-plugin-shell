import type { Services } from "../../bootstrap/services.ts";
import { createRelationshipSession } from '../application/relationship-session.ts';
const sessions = new WeakMap<Services,ReturnType<typeof createRelationshipSession>>();
/** Shared across this runtime's generated adapters. External vault changes still require reconciliation. */
export function createRelationshipIntegrity(shell:Services){
 const existing=sessions.get(shell);if(existing)return existing;
 const session=createRelationshipSession([{"id":"er-relationship-56","source":"requirement","target":"plugin-project","key":"project_ref","sourceCard":"0..*","targetCard":"0..1","onDelete":"restrict"},{"id":"er-relationship-57","source":"screen","target":"plugin-project","key":"project_ref","sourceCard":"0..*","targetCard":"0..1","onDelete":"restrict"},{"id":"er-relationship-58","source":"requirement","target":"screen","key":"screen_refs","sourceCard":"0..*","targetCard":"0..*","onDelete":"restrict"},{"id":"er-relationship-59","source":"screen","target":"component","key":"component_refs","sourceCard":"0..*","targetCard":"0..*","onDelete":"restrict"},{"id":"er-relationship-60","source":"source-operation","target":"data-source","key":"source_ref","sourceCard":"0..*","targetCard":"0..1","onDelete":"restrict"},{"id":"er-relationship-61","source":"test-recipe","target":"source-operation","key":"operation_ref","sourceCard":"0..*","targetCard":"0..1","onDelete":"restrict"},{"id":"er-relationship-62","source":"design-token","target":"plugin-project","key":"project_ref","sourceCard":"0..*","targetCard":"0..1","onDelete":"restrict"}],async()=>{
  const results=await Promise.all([shell.repositories.GPluginProject.list(),shell.repositories.GRequirement.list(),shell.repositories.GScreen.list(),shell.repositories.GComponent.list(),shell.repositories.GDataSource.list(),shell.repositories.GSourceOperation.list(),shell.repositories.GTestRecipe.list(),shell.repositories.GDesignToken.list()]);
  const records:import('../domain/relationships.ts').RelationshipRecord[]=[];
 for(const result of results){if(!result.ok)throw new Error('RELATIONSHIP_READ_FAILED');records.push(...result.value);}return records;
 });
 sessions.set(shell,session);return session;
}
export function disposeRelationshipIntegrity(shell:Services){sessions.get(shell)?.dispose();sessions.delete(shell);}
