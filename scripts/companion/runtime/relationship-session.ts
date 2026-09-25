import { assertRelationshipMutation, type RelationshipRule, type RelationshipRecord, type RelationshipMutation } from './relationships.ts';
type Result<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:{readonly code:string}};
interface Plan {readonly entity:string;readonly id:string;readonly path:string}
interface Notes<I,S extends RelationshipRecord,P extends Plan> {
  list():Promise<Result<readonly S[]>>;
  prepare(values:I,request:string):Result<P>;
  discard(plan:P):boolean;
  commit(plan:P):Promise<Result<S>>;
  update(snapshot:S,values:I,permit:{active():boolean}):Promise<Result<S>>;
  delete(snapshot:S,permit:{active():boolean}):Promise<Result<void>>;
}
export interface RelationshipSession {
  run<T>(mutation:RelationshipMutation,commit:()=>Promise<T>,active:()=>boolean):Promise<T>;
}
/** One session across generated source adapters serializes their graph preflight and writes.
 * External/native writers are NOT a cross-file transaction and still need reconciliation. */
export function createRelationshipSession(rules: readonly RelationshipRule[], read:()=>Promise<readonly RelationshipRecord[]>):RelationshipSession {
  let tail:Promise<unknown>=Promise.resolve();
  return {run<T>(mutation:RelationshipMutation,commit:()=>Promise<T>,active:()=>boolean):Promise<T>{
    const work=tail.then(async()=>{
      if(!active())throw new Error('OPERATION_ABORTED');
      const graph=await read();if(!active())throw new Error('OPERATION_ABORTED');
      assertRelationshipMutation(rules,graph,mutation);
      if(!active())throw new Error('OPERATION_ABORTED');return commit();
    });
    tail=work.catch(()=>{});return work;
  }};
}
/** Preserve canonical creation plans/idempotency instead of assigning a second note identity. */
export function protectNoteRelationships<I extends object,S extends RelationshipRecord,P extends Plan>(repository:Notes<I,S,P>,session:RelationshipSession){
  const attempts=new WeakMap<P,Promise<Result<S>>>();
  return {
    list:()=>repository.list(),
    async create(values:I,requestId:string,permit={active:()=>true}):Promise<Result<S>>{
      const prepared=repository.prepare(values,requestId);if(!prepared.ok)return prepared;
      const plan=prepared.value;const existing=attempts.get(plan);if(existing)return existing;
      let attempted=false;
      const work=session.run({mode:'create',record:{entity:plan.entity,id:plan.id,path:plan.path,values}},()=>{attempted=true;return repository.commit(plan);},permit.active);
      attempts.set(plan,work);
      // A rejected preflight has not attempted persistence; release only that unused canonical plan.
      void work.catch(()=>{if(!attempted)repository.discard(plan);});return work;
    },
    update(snapshot:S,values:I,permit:{active():boolean}){
      return session.run({mode:'update',record:{...snapshot,values}},()=>repository.update(snapshot,values,permit),permit.active);
    },
    delete(snapshot:S,permit:{active():boolean}){
      return session.run({mode:'delete',record:snapshot},()=>repository.delete(snapshot,permit),permit.active);
    },
  };
}
