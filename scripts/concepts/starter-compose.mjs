/** Named trusted-source assembly seams; never evaluates a starter definition. */
import ts from 'typescript';
export function composeStarterWorkspace(program, startup) {
  const parse=text=>ts.createSourceFile('workspace.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const source=parse(program), additions=parse(startup), replacements=new Map(), consumed=new Set();
  for(const statement of additions.statements)if(ts.isFunctionDeclaration(statement)&&statement.name)replacements.set(statement.name.text,statement);
  const edits=[];
  for(const statement of source.statements){
    if(!ts.isFunctionDeclaration(statement)||!statement.name)continue;
    const name=statement.name.text;
    if(name.startsWith('companionExample')||name==='jmSeed')edits.push([statement.getStart(source),statement.end,'']);
    else if(replacements.has(name)){edits.push([statement.getStart(source),statement.end,replacements.get(name).getText(additions)]);consumed.add(name);}
  }
  for(const name of ['vaultWelcomeView','projectStartersView','starterResults','openStarter','starterDraftDocument','starterReviewBanner','openCompanionImport','handleStarterAction']){
    if(!consumed.has(name))throw Error('STARTER_ASSEMBLY: Missing named workspace seam '+name);
  }
  for(const [start,end,text] of edits.reverse())program=program.slice(0,start)+text+program.slice(end);
  const tail=additions.statements.filter(statement=>!ts.isFunctionDeclaration(statement)||!statement.name||!consumed.has(statement.name.text)).map(statement=>statement.getText(additions)).join('\n');
  function once(from,to){if(program.split(from).length!==2)throw Error('STARTER_ASSEMBLY: Missing/ambiguous startup seam '+from.slice(0,80));program=program.replace(from,to);}
  once("const factories={'starter-configure':","const factories={'starter-recipe':starterRecipeDialog,'starter-configure':");
  once("if(action==='vault-save'){saveVaultIdentity();return true;}","if(action==='vault-save'){const before=project();saveVaultIdentity();if(!before&&project())starterSetupAfterCreate();return true;}");
  once("notify('Project imported into this vault’s workspace. No source was generated, acquired or activated.');", "notify('Project imported into this vault’s workspace. No source was generated, acquired or activated.');starterSetupAfterCreate();");
  once('starter: { id: entry.id, version: entry.version, name: entry.name }', 'starter: { id: entry.id, version: entry.version, name: entry.name, sha256:starterWorkspaceUi.reviewHash }');
  once('companionCanReplace(u.snapshot);', 'companionCanReplace(u.snapshot);verifyStarterReview();');
  once('function welcomeStep(){return ', 'function welcomeStep(){return starterSetupNotice()+');
  program=program.replaceAll('Shell Workbench','Workbench').replaceAll('Load companion project','Choose Companion starter').replaceAll('Bundled companion project','External Companion starter').replaceAll(' · built-in ', ' · external ');
  // Declarations and listeners must exist before the original program's first render.
  return tail+'\n'+program;
}
export function removeEmbeddedStarterData(html) {
  let count=0;
  html=html.replace(/<script type="application\/json" id="project-starters-data">[\s\S]*?<\/script>/g,()=>{count++;return '<script type="application/json" id="project-starters-data">{"schemaVersion":1,"starters":[]}</script>';});
  html=html.replace(/<script type="application\/json" id="companion-visual-seed">[\s\S]*?<\/script>/g,()=>{count++;return '';});
  if(count!==2)throw Error('STARTER_ASSEMBLY: Expected the two legacy seed blocks to remove.');
  return html.replaceAll('Shell Workbench', 'Workbench');
}
