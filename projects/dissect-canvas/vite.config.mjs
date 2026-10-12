import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {APP,VERSION,UI_VERSION,COMPONENT_PREFIX} from './app.config.mjs';

function licenseNotices(){return {name:'family-license-notices',async generateBundle(options,bundle){
  const names=new Set(['@nuxt/ui','vue','tailwindcss','@iconify-json/lucide']);
  for(const chunk of Object.values(bundle))if(chunk.type==='chunk')for(const moduleId of Object.keys(chunk.modules)){const match=moduleId.match(/node_modules\/(\@[^/]+\/[^/]+|[^/]+)/);if(match)names.add(match[1]);}
  let notices='THIRD-PARTY NOTICES\nObsidian Product Family prototypes\n\nThe original specialized editors retain their own embedded notices.\nThe compiled common shell includes the following packages.\n\n';
  for(const name of [...names].sort()){
    const dir=path.resolve('node_modules',name);let pkg;try{pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));}catch{continue;}
    notices+='\n'+'='.repeat(70)+'\n'+name+' '+pkg.version+'\nLicense: '+JSON.stringify(pkg.license||'See package source')+'\n';
    const entries=await fs.readdir(dir);const candidates=entries.filter(n=>/^licen[sc]e(?:\.md|\.txt)?$|^copying(?:\.md|\.txt)?$/i.test(n));
    if(candidates.length)for(const file of candidates)notices+='\n'+await fs.readFile(path.join(dir,file),'utf8');
    else notices+='Source: '+JSON.stringify(pkg.repository||pkg.homepage||name)+'\n';
  }
  this.emitFile({type:'asset',fileName:'THIRD-PARTY-NOTICES.txt',source:notices});
}};}

// The development server always serves this project's one editor, embedded the same way scripts/package.mjs embeds it.
function familyEditorDev(){return {name:'family-editor-dev',apply:'serve',transformIndexHtml:{order:'pre',async handler(html){
  let editor=await fs.readFile(path.resolve('editors',APP.file),'utf8');
  const editorTheme=await fs.readFile(path.resolve('src/editor-theme.css'),'utf8'),bridge=await fs.readFile(path.resolve('src/editor-bridge.js'),'utf8');
  editor=editor.replace(/<html([^>]*)>/,(_,attrs)=>'<html'+attrs.replace(/\sclass="[^"]*"/,'')+' class="family-editor">');
  editor=editor.replace('</head>',()=>'<style>'+editorTheme+'</style></head>').replace('</body>',()=>'<script>'+bridge+'</script></body>');
  return html.replace('__FAMILY_EDITOR_BASE64__',()=>Buffer.from(editor).toString('base64')).replace(/(<script type="application\/json" id="family-config">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify({appId:APP.appId,file:APP.file,version:VERSION,uiVersion:UI_VERSION})+b);
}}};}

export default defineConfig({
  server:{port:4173},
  plugins:[familyEditorDev(),vue(),ui({prefix:COMPONENT_PREFIX,colorMode:false,dts:false,ui:{colors:{primary:'violet',neutral:'zinc'}},icon:{clientBundle:{scan:true,icons:['lucide:boxes','lucide:panels-top-left','lucide:network','lucide:scan','lucide:folder','lucide:layers','lucide:map','lucide:list','lucide:users','lucide:settings','lucide:circle-help','lucide:git-branch','lucide:clipboard-check','lucide:arrow-left-right','lucide:book-open','lucide:layout-grid','lucide:mouse-pointer-2','lucide:message-square','lucide:play','lucide:file-code','lucide:link','lucide:package','lucide:arrow-up-right','lucide:plus','lucide:search','lucide:moon','lucide:sun','lucide:download','lucide:upload','lucide:undo-2','lucide:redo-2','lucide:panel-left-close','lucide:panel-left-open','lucide:chevron-right','lucide:check','lucide:x','lucide:external-link','lucide:filter','lucide:copy','lucide:ellipsis','lucide:triangle-alert','lucide:circle','lucide:shield-check','lucide:keyboard','lucide:diamond','lucide:file-text','lucide:refresh-cw','lucide:unlink','lucide:arrow-right','lucide:monitor','lucide:grip','lucide:eye','lucide:calendar-range']}}})],
  build:{outDir:'dist/shell',assetsInlineLimit:100000000,cssCodeSplit:false,rollupOptions:{plugins:[licenseNotices()],output:{inlineDynamicImports:true}},chunkSizeWarningLimit:1200},
  base:'./'
});
