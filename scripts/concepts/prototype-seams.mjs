/** Exact, additive composition seams over the assembled build base (the current format is project v6 only). */
export function composePrototypeSeams(source) {
  let program = source;
  const once = (from,to) => { if(program.split(from).length!==2)throw Error('PROTOTYPE_ASSEMBLY: Ambiguous seam '+from.slice(0,100));program=program.replace(from,to); };
  once("['overview','box','Project overview'],", "['overview','box','Project overview'],['prototypes','layers','Manage prototypes'],");
  once('const views={starters:', 'const views={prototypes:pmWorkspaceView,starters:');
  once('companionValidTooling(s.project.tooling)&&','companionValidTooling(s.project.tooling)&&pmValidWorkspace(s.project.prototypes,s.project.id)&&');
  once('function setView(view){','function setView(view){if(pmEditor&&!pmEditor.canLeave())return;');
  once('function render(){','function render(){if(pmEditor&&!pmEditor.canLeave())return;pmUnmount();');
  once('restoreUiFocus(uiFocus);jmMount();','restoreUiFocus(uiFocus);jmMount();pmMount();');
  once('Object.assign(p,values);p.rev++;', 'pmGuardIdentity(values.id);Object.assign(p,values);p.rev++;');
  once('function beginVaultSetup(){', "function beginVaultSetup(){try{pmGuardIdentity(state.wizard?.id);}catch(error){return wizardError(error.message);}");
  once('const p = companionCandidate(u.text);','const p = companionCandidate(u.text);pmPreserveWorkspace(p);');
  return program;
}
