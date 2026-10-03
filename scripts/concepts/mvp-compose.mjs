import { composePrototypeSeams } from './prototype-seams.mjs';
import ts from 'typescript';
/** Mount the Journey Lens and prototype islands into the schema 6 concept; never execute authored project text. */
export function composeMvp(base,bundle,css,bridge,graphStyle) {
  const markers=[...base.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(m=>m[1].includes('function render()'));
  if(markers.length!==1)throw Error('MVP_ASSEMBLY: Expected one concept program.');
  const marker=markers[0];let program=marker[1];
  const replacements={

    sitemapView:'function sitemapView(){return `<div id="jm-root" class="ps--plugin-shell" data-plugin-ui="plugin-shell"></div>`;}',
    vaultWelcomeView:'function vaultWelcomeView(){return jmWelcomeView();}',
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
  once('function setView(view){','function setView(view){if(jmEditor&&!jmEditor.canLeave())return;');
  once('function render(){','function render(){if(jmEditor&&!jmEditor.canLeave())return;jmUnmount();');
  once('restoreUiFocus(uiFocus);','restoreUiFocus(uiFocus);jmMount();');
  // Functions are hoisted; bridge state must be initialized before the preserved startup restore/render.
  program=bridge+'\n'+composePrototypeSeams(program);
  const safe=text=>text.replace(/<\/script/gi,'<\\/script');
  const script='<script data-journey-runtime>'+safe(bundle)+'</script>\n<script>'+safe(program)+'</script>';
  let html=base.slice(0,marker.index)+script+base.slice(marker.index+marker[0].length);
  // The scoped graph stylesheet is already verified by the concept assembly; reuse its namespace for this island.
  if(typeof graphStyle!=='string'||!graphStyle.includes('#vf-root .vue-flow__container {'))throw Error('MVP_ASSEMBLY: Missing complete scoped Vue Flow stylesheet.');
  const graphCss=graphStyle.replaceAll('#vf-root','#jm-root');
  return html.replace('</head>','<style data-journey-style>'+css+'\n'+graphCss+'</style></head>');
}
