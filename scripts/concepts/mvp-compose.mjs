import { composePrototypeSeams } from './prototype-seams.mjs';
import ts from 'typescript';
/** Replace named functions in a trusted assembled fixture, never execute authored project text. */
export function composeMvp(base,bundle,css,bridge,graphStyle) {
  const markers=[...base.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(m=>m[1].includes('function render()'));
  if(markers.length!==1)throw Error('MVP_ASSEMBLY: Expected one legacy companion program.');
  const marker=markers[0];let program=marker[1];
  const replacements={
    validateCompanionDocument:'function validateCompanionDocument(v){return CompanionJourney.validateAuthoringDocument(v);}',
    parseCompanionDocument:'function parseCompanionDocument(v){return CompanionJourney.parseAuthoringDocument(v);}',
    migrateCompanionDocument:'function migrateCompanionDocument(v){const r=CompanionJourney.migrateAuthoringDocument(v);return {document:r.document,report:r.report?.legacy??null};}',
    companionDesignKey:'function companionDesignKey(k){return CompanionJourney.authoringDesignKey(k);}',
    sitemapView:'function sitemapView(){return `<div id="jm-root" class="ps--plugin-shell" data-plugin-ui="plugin-shell"></div>`;}',
  };
  const source=ts.createSourceFile('companion.js',program,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),changes=[];
  for(const statement of source.statements){
    if(ts.isFunctionDeclaration(statement)&&statement.name&&replacements[statement.name.text]){
      changes.push([statement.getStart(source),statement.end,replacements[statement.name.text]]);delete replacements[statement.name.text];
    }
  }
  if(Object.keys(replacements).length)throw Error('MVP_ASSEMBLY: Missing named composition seam.');
  for(const [start,end,text] of changes.reverse())program=program.slice(0,start)+text+program.slice(end);
  function once(from,to){if(program.split(from).length!==2)throw Error('MVP_ASSEMBLY: Ambiguous seam '+from.slice(0,100));program=program.replace(from,to);}
  // Preserve the independently validated optional tooling through import/export and recovery.
  once('project: identity, settings: companionFolders(p), design, notes: designCopy(p.notes || [])',
    'project: identity, settings: companionFolders(p), design, notes: designCopy(p.notes || []),...(p.tooling===undefined?{}:{tooling:designCopy(p.tooling)})');
  once('p.notes = designCopy(document.notes);','p.notes = designCopy(document.notes);if(document.tooling!==undefined)p.tooling=designCopy(document.tooling);');
  once('validCompanionProjectFolders(s.project.folders)&&','validCompanionProjectFolders(s.project.folders)&&jmValidTooling(s.project.tooling)&&');
  once('const COMPANION_VERSION = 5;','const COMPANION_VERSION = 6;');
  // The immutable embedded catalog was hash-verified as v5 by the retained builder.
  // Import migrates its configured copy through the v6 authoring validator.
  once("entry.document.schemaVersion === COMPANION_VERSION, 'Built-ins require project v' + COMPANION_VERSION + '.'",
    "entry.document.schemaVersion === 5, 'The retained catalog requires project v5.'");
  once("![1,2,3,4,5].includes(value.schema)","![1,2,3,4,5,6].includes(value.schema)");
  once('return veShape(value)&&smShape(value.storymaps)','return jmValidFields(value)&&veShape(value)&&smShape(value.storymaps)');
  once('...(d.visualDesigns?{visualDesigns:d.visualDesigns}:{})','...(d.visualDesigns?{visualDesigns:d.visualDesigns}:{}),...(d.sitemap?{sitemap:d.sitemap}:{}),...(d.features?{features:d.features}:{}),...(d.editors?{editors:d.editors}:{})');
  once('Object.assign(d,snapshot);','Object.assign(d,snapshot);if(!snapshot.sitemap)delete d.sitemap;if(!snapshot.features)delete d.features;if(!snapshot.editors)delete d.editors;');
  once('blueprint:clean.blueprint,goal:clean.goal','sitemap:clean.sitemap,features:clean.features,editors:clean.editors,blueprint:clean.blueprint,goal:clean.goal');
  once('schema:clean.visualDesigns?COMPANION_VERSION:4','schema:COMPANION_VERSION');
  once('function setView(view){','function setView(view){if(jmEditor&&!jmEditor.canLeave())return;');
  once('function render(){','function render(){if(jmEditor&&!jmEditor.canLeave())return;jmUnmount();');
  once('restoreUiFocus(uiFocus);','restoreUiFocus(uiFocus);jmMount();');
  once("  return p;\n}\nfunction companionExampleRequirements", "  return jmSeed(p);\n}\nfunction companionExampleRequirements");
  // Functions are hoisted; state must be initialized before the preserved startup restore/render.
  program=bridge+'\n'+composePrototypeSeams(program);
  const safe=text=>text.replace(/<\/script/gi,'<\\/script');
  const script='<script data-journey-runtime>'+safe(bundle)+'</script>\n<script>'+safe(program)+'</script>';
  let html=base.slice(0,marker.index)+script+base.slice(marker.index+marker[0].length);
  // The scoped graph stylesheet is already verified by the old assembly; reuse its namespace for this island.
  if(typeof graphStyle!=='string'||!graphStyle.includes('#vf-root .vue-flow__container {'))throw Error('MVP_ASSEMBLY: Missing complete scoped Vue Flow stylesheet.');
  const graphCss=graphStyle.replaceAll('#vf-root','#jm-root');
  html=html.replace('</head>','<style data-journey-style>'+css+'\n'+graphCss+'</style></head>');
  return html;
}
