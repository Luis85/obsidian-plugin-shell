/** Exact, additive composition seams: the historical v5 fixtures are never rewritten. */
export function composePrototypeSeams(source) {
  let program = source;
  const once = (from,to) => { if(program.split(from).length!==2)throw Error('PROTOTYPE_ASSEMBLY: Ambiguous seam '+from.slice(0,100));program=program.replace(from,to); };
  once("['overview','box','Project overview'],", "['overview','box','Project overview'],['prototypes','layers','Manage prototypes'],");
  once('const views={starters:', 'const views={prototypes:pmWorkspaceView,starters:');
  once('jmValidTooling(s.project.tooling)&&','jmValidTooling(s.project.tooling)&&pmValidWorkspace(s.project.prototypes,s.project.id)&&');
  once('function setView(view){','function setView(view){if(pmEditor&&!pmEditor.canLeave())return;');
  once('function render(){','function render(){if(pmEditor&&!pmEditor.canLeave())return;pmUnmount();');
  once('restoreUiFocus(uiFocus);jmMount();','restoreUiFocus(uiFocus);jmMount();pmMount();');
  once('Object.assign(p,values);p.rev++;', 'pmGuardIdentity(values.id);Object.assign(p,values);p.rev++;');
  once('function beginVaultSetup(){', "function beginVaultSetup(){try{pmGuardIdentity(state.wizard?.id);}catch(error){return wizardError(error.message);}");
  once('const p = companionCandidate(u.text);','const p = companionCandidate(u.text);pmPreserveWorkspace(p);');
  once("const p = project(); if (!p) return dialogBody('Generate a starter', '<p>Choose and confirm a starter first.</p>', button('Close','close','','ghost'));",
    "const p = pmGenerationProject(); if (!p) return dialogBody('Generation source required', '<p>Choose a project, then approve and activate a saved variant in Manage prototypes. No working-copy fallback is used for a managed workspace.</p>', button('Close','close','','ghost')+button('Manage prototypes','prototype-manage','','primary'));");
  once("`<p>The exported project JSON is the only thing that leaves this page.", "`<p><strong>Generation source:</strong> ${esc(pmGenerationLabel())}</p><p>The exported project JSON is the only thing that leaves this page.");
  once("button('Download project JSON','project-backup','','primary','download')", "button('Download project JSON','prototype-download-active','','primary','download')");
  once("${esc(companionFolders().codebaseFolder)}/generated</code> · Tests: <code>${esc(companionFolders().testsFolder)}/project", "${esc(companionFolders(p).codebaseFolder)}/generated</code> · Tests: <code>${esc(companionFolders(p).testsFolder)}/project");
  return program;
}
