import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import fs from 'node:fs/promises';
import path from 'node:path';

function notices(){return {name:'third-party-notices',async generateBundle(options,bundle){
  const names=new Set(['@nuxt/ui','vue','tailwindcss','@iconify-json/lucide']);
  for(const chunk of Object.values(bundle))if(chunk.type==='chunk')for(const module of Object.keys(chunk.modules)){
    const m=module.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);if(m)names.add(m[1]);
  }
  let text='THIRD-PARTY NOTICES\nResource Atlas prototype\n\n';
  for(const name of [...names].sort()){
    const dir=path.resolve('node_modules',name);let pkg;try{pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));}catch{continue;}
    text+='\n'+name+' '+pkg.version+'\nLicense: '+JSON.stringify(pkg.license||'See package source')+'\n';
    const candidates=(await fs.readdir(dir)).filter(n=>/^licen[sc]e(?:\.md|\.txt)?$|^copying(?:\.md|\.txt)?$/i.test(n));
    if(candidates.length)for(const file of candidates)text+='\n'+await fs.readFile(path.join(dir,file),'utf8');
    else text+='Source: '+JSON.stringify(pkg.repository||pkg.homepage||name)+'\n';
  }
  this.emitFile({type:'asset',fileName:'THIRD-PARTY-NOTICES.txt',source:text});
}};}
const icons=['diamond','calendar-range','calendar-days','calendar-off','calendar','clock','users','user-round','chart-column','table-2','settings','circle-help','folder','folder-open','file-text','file-json','file-down','plus','minus','search','moon','sun','download','upload','undo-2','redo-2','panel-left-close','panel-left-open','chevron-right','chevron-left','chevron-down','check','x','external-link','filter','copy','ellipsis','triangle-alert','circle','keyboard','refresh-cw','link','unlink','arrow-right','arrow-left','monitor','grip-vertical','eye','mouse-pointer-2','ban','pencil','trash-2','maximize','move-horizontal','scissors','package','boxes','panels-top-left','network','scan','arrow-up-right','arrow-left-right','book-open','save','info','layers'];
export default defineConfig({
  server:{port:4176},
  plugins:[vue(),ui({prefix:'Pf',colorMode:false,dts:false,ui:{colors:{primary:'violet',neutral:'zinc'}},icon:{clientBundle:{scan:true,icons:icons.map(n=>'lucide:'+n)}}})],
  build:{outDir:'dist/shell',assetsInlineLimit:100000000,cssCodeSplit:false,rollupOptions:{plugins:[notices()],output:{inlineDynamicImports:true}},chunkSizeWarningLimit:1400},
  base:'./'
});
