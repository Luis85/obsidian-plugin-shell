import type { GAuthoringVaultPort } from '../../application/authoring-vault/contracts.ts';
import type { Services } from "../../../bootstrap/services.ts";


import type { RelationshipSession } from '../../application/relationship-session.ts';



/** Native mappings use the shell's canonical repositories; other adapters remain explicit. */
export const createGAuthoringVaultAdapter: (shell: Services, integrity: RelationshipSession) => GAuthoringVaultPort = (_shell) => {


  return {
    async "list-requirements"(_input, signal) { if(signal?.aborted) throw new Error('OPERATION_ABORTED'); const result=await _shell.repositories.GRequirement.list(); if(!result.ok) throw new Error('NOTE_READ_FAILED'); return result.value.map(snapshot=>({...snapshot.values,id:snapshot.id,type:"requirement"})); },
    async "list-sitemap"(_input, signal) { if(signal?.aborted) throw new Error('OPERATION_ABORTED'); const result=await _shell.repositories.GScreen.list(); if(!result.ok) throw new Error('NOTE_READ_FAILED'); return result.value.map(snapshot=>({...snapshot.values,id:snapshot.id,type:"screen"})); },
    async "list-components"(_input, signal) { if(signal?.aborted) throw new Error('OPERATION_ABORTED'); const result=await _shell.repositories.GComponent.list(); if(!result.ok) throw new Error('NOTE_READ_FAILED'); return result.value.map(snapshot=>({...snapshot.values,id:snapshot.id,type:"component"})); },
  };
};
