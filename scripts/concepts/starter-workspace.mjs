import ts from 'typescript';
/** Isolate the current empty-start experience from the immutable historical v5 fixture. */
export function composeStarterWorkspace(html, bridge) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(match => match[1].includes('function render()'));
  if (scripts.length !== 1) throw Error('STARTER_ASSEMBLY: Expected one authoring program.');
  const marker = scripts[0], source = ts.createSourceFile('authoring.js', marker[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const incoming = ts.createSourceFile('starters.js', bridge, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = new Map(incoming.statements.filter(ts.isFunctionDeclaration).map(item => [item.name.text, item.getText(incoming)]));
  const edits = [], used = new Set();
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) continue;
    const name = statement.name.text;
    if (functions.has(name)) { edits.push([statement.getStart(source), statement.end, functions.get(name)]); used.add(name); }
    // The golden definition, rather than an executable seed factory, owns the Companion model.
    else if (name.startsWith('companionExample') || name === 'jmSeed') edits.push([statement.getStart(source), statement.end, '']);
  }
  for (const name of ['projectStartersView', 'starterResults', 'renderStarterResults', 'starterCard', 'openStarter', 'starterDraftDocument', 'handleStarterAction', 'companionExampleProject', 'vaultWelcomeView']) {
    if (!used.has(name)) throw Error('STARTER_ASSEMBLY: Missing named seam ' + name);
  }
  let program = marker[1];
  for (const [start, end, text] of edits.reverse()) program = program.slice(0, start) + text + program.slice(end);
  const once = (from, to) => { if (program.split(from).length !== 2) throw Error('STARTER_ASSEMBLY: Ambiguous seam ' + from); program = program.replace(from, to); };
  once("const starterCatalog = validateStarterCatalog(JSON.parse(document.getElementById('project-starters-data').textContent));", 'const starterCatalog = { schemaVersion: 1, starters: [] };');
  once("view:'overview',project:null", "view:'starters',project:null");
  once("closeModal(); setView('overview');\n    notify('Project imported", "closeModal(); wkAfterStarterImport();\n    notify('Project imported");
  once("closeModal();setView(p?'overview':f.after);notify('Project details", "closeModal();wkAfterIdentitySave(p,f.after);notify('Project details");
  program = program.replaceAll(' · built-in ', ' · starter ').replaceAll(' · Built-in ', ' · Starter ');
  // Add imports/state/unique helpers before existing initialization; no execution of definition source.
  const additions = incoming.statements.filter(item => !ts.isFunctionDeclaration(item) || !used.has(item.name.text)).map(item => item.getText(incoming)).join('\n');
  program = additions + '\n' + program;
  let output = html.slice(0, marker.index) + '<script>' + program.replace(/<\/script/gi, '<\\/script') + '</script>' + html.slice(marker.index + marker[0].length);
  for (const id of ['project-starters-data', 'companion-visual-seed']) {
    const pattern = new RegExp('<script\\s+type="application/json"\\s+id="' + id + '">[\\s\\S]*?<\\/script>', 'g');
    if ([...output.matchAll(pattern)].length !== 1) throw Error('STARTER_ASSEMBLY: Missing or repeated embedded data ' + id);
    output = output.replace(pattern, '');
  }
  if (output.includes('document.getElementById(\'companion-visual-seed\')') || output.includes('function jmSeed(')) throw Error('STARTER_ASSEMBLY: A self-project seed remains bundled.');
  return output;
}
