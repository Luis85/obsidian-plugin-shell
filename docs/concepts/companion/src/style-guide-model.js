// Project-owned design declarations, never a replacement for the host's theme.
const SG_GROUPS=Object.freeze({fonts:'Fonts',typography:'Typography',spacing:'Spacing',sizes:'Sizes',radii:'Corner radii',colors:'Colors',guidelines:'Usage guidelines'});
const SG_FONT_SOURCES=Object.freeze({interface:'Obsidian interface font',text:'Obsidian text font',mono:'Obsidian monospace font',custom:'Named local font stack'});
function sgBlank(name='Project design system'){return {schema:1,name,description:'',principles:'',fonts:[],typography:[],spacing:[],sizes:[],radii:[],colors:[],guidelines:[]};}
function sgStarter(){
 const s=sgBlank((project()?.name||'Plugin')+' design system');s.name=s.name.slice(0,100);
 s.description='A starting point for a plugin that belongs in Obsidian. Customize these declarations before implementation.';
 s.principles='Prefer the host theme and user font preferences.\nUse consistent spacing to group related information.\nProvide visible keyboard focus and a non-color-only selected state.';
 s.fonts=[{id:'interface',name:'Interface',source:'interface',families:'',fallback:'system-ui',usage:'Navigation, controls and labels.',license:'Host font preference. No font files are embedded.'},{id:'body',name:'Reading',source:'text',families:'',fallback:'sans-serif',usage:'Descriptions and long-form content.',license:'Host font preference. No font files are embedded.'},{id:'code',name:'Code',source:'mono',families:'',fallback:'monospace',usage:'Identifiers, paths and code samples.',license:'Host font preference. No font files are embedded.'}];
 s.typography=[{id:'page-title',name:'Page title',font:'interface',size:24,unit:'px',weight:600,lineHeight:1.25,letterSpacing:0,usage:'One primary heading per view.'},{id:'section-title',name:'Section title',font:'interface',size:18,unit:'px',weight:600,lineHeight:1.4,letterSpacing:0,usage:'Group related controls or content.'},{id:'body',name:'Body',font:'body',size:16,unit:'px',weight:400,lineHeight:1.5,letterSpacing:0,usage:'Main descriptive copy.'},{id:'label',name:'Label',font:'interface',size:14,unit:'px',weight:500,lineHeight:1.4,letterSpacing:0,usage:'Form labels; do not rely on placeholders.'}];
 s.spacing=[['xs',4,'Related inline items'],['sm',8,'Within a control group'],['md',16,'Between related blocks'],['lg',24,'Between sections'],['xl',32,'Major content separation']].map(([id,value,usage])=>({id,name:id.toUpperCase(),value,unit:'px',usage}));
 s.sizes=[{id:'control',name:'Control height',value:36,unit:'px',usage:'Proposed default, not an accessibility guarantee.'},{id:'icon',name:'Icon',value:18,unit:'px',usage:'Glyph size, not the clickable target.'},{id:'inspector',name:'Inspector width',value:320,unit:'px',usage:'Preferred width; adapt for narrower panes.'}];
 s.radii=[{id:'control',name:'Control radius',value:6,unit:'px',usage:'Inputs and compact actions.'},{id:'surface',name:'Surface radius',value:12,unit:'px',usage:'Standalone panels.'}];
 s.colors=[['background','Background','#FFFFFF','#1E1E24','--background-primary'],['text','Primary text','#202027','#ECECF2','--text-normal'],['muted','Secondary text','#595964','#B6B6C4','--text-muted'],['accent','Accent','#6550B9','#B7A3FF','--interactive-accent'],['accent-text','Text on accent','#FFFFFF','#17131F','--text-on-accent']].map(([id,name,light,dark,host])=>({id,name,light,dark,host,usage:'Illustrative fallback palette; resolve the named variable from the active host theme.'}));
 s.guidelines=[{id:'interaction',name:'Interaction states',usage:'Provide default, hover, pressed, selected, focused, disabled and error states. Keep focus visible; do not use color as the only state indicator.'},{id:'components',name:'Component usage',usage:'Use the shared component library and document any variant-specific differences. These notes do not automatically restyle component implementations.'}];return s;
}
function sgKeys(v,allowed){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));}
function sgText(v,max=1000){return typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);}
function sgId(v){return typeof v==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v)&&v.length<=60&&!['constructor','prototype'].includes(v);}
function sgNumber(v,min,max){return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;}
function sgFontNames(v){return sgText(v,200)&&v.split(',').every(n=>/^[\p{L}\p{N} _-]{1,70}$/u.test(n.trim()));}
function sgIssues(s){
 if(s===undefined)return [];
 if(!sgKeys(s,['schema','name','description','principles',...Object.keys(SG_GROUPS)])||s.schema!==1||!sgText(s.name,100)||!s.name.trim()||!sgText(s.description,2000)||!sgText(s.principles,4000))return ['Give the design system a name and keep descriptions within their limits.'];
 const errors=[];
 for(const group of Object.keys(SG_GROUPS)){
  const rows=s[group];if(!Array.isArray(rows)||rows.length>(group==='fonts'?12:64)){errors.push(SG_GROUPS[group]+': too many or malformed entries.');continue;}
  const ids=new Set();for(const r of rows){
   if(!r||!sgId(r.id)||ids.has(r.id)||!sgText(r.name,100)||!r.name.trim()||!sgText(r.usage,2000)){errors.push(SG_GROUPS[group]+': use a unique code name, a visible name and a bounded description.');continue;}ids.add(r.id);
   const base=['id','name','usage'];
   if(group==='fonts'){
    if(!sgKeys(r,[...base,'source','families','fallback','license'])||!Object.hasOwn(SG_FONT_SOURCES,r.source)||!['system-ui','sans-serif','serif','monospace'].includes(r.fallback)||!sgText(r.families,200)||!sgText(r.license,1000)||r.source==='custom'&&!sgFontNames(r.families))errors.push(r.name+': specify local family names separated by commas, a fallback and font provenance. URLs, CSS and font files are not accepted.');
   }else if(group==='typography'){
    if(!sgKeys(r,[...base,'font','size','unit','weight','lineHeight','letterSpacing'])||!Array.isArray(s.fonts)||!s.fonts.some(f=>f.id===r.font)||!['px','rem'].includes(r.unit)||!sgNumber(r.size,.1,r.unit==='rem'?12:192)||!Number.isInteger(r.weight)||r.weight<100||r.weight>900||!sgNumber(r.lineHeight,1,3)||!sgNumber(r.letterSpacing,-2,10))errors.push(r.name+': choose an existing font, valid size, weight 100–900, line height 1–3 and letter spacing −2–10 px.');
   }else if(['spacing','sizes','radii'].includes(group)){
    if(!sgKeys(r,[...base,'value','unit'])||!['px','rem'].includes(r.unit)||!sgNumber(r.value,0,r.unit==='rem'?100:1600))errors.push(r.name+': use a non-negative size with px or rem units (up to 1,600 px / 100 rem).');
   }else if(group==='colors'){
    if(!sgKeys(r,[...base,'light','dark','host'])||!/^#[0-9a-f]{6}$/i.test(r.light)||!/^#[0-9a-f]{6}$/i.test(r.dark)||!sgText(r.host,80)||r.host!==''&&!/^--[a-z][a-z0-9-]*$/.test(r.host))errors.push(r.name+': provide six-digit hex colors and an optional CSS variable name, not a CSS expression.');
   }else if(!sgKeys(r,base))errors.push(r.name+': unsupported guideline fields.');
  }
 }
 return errors;
}
function validStyleGuide(s){try{return sgIssues(s).length===0;}catch{return false;}}
function styleGuide(d=design()){return d.designSystem;}
function sgFontCSS(font,host=true){
 if(!font)return 'system-ui';
 if(font.source!=='custom')return host?'var('+({interface:'--font-interface',text:'--font-text',mono:'--font-monospace'})[font.source]+', '+font.fallback+')':font.fallback;
 return font.families.split(',').map(s=>JSON.stringify(s.trim())).concat(font.fallback).join(', ');
}
function sgTypeCSS(t,s,host=true){return `font-family:${sgFontCSS(s.fonts.find(f=>f.id===t.font),host)};font-size:${t.size}${t.unit};font-weight:${t.weight};line-height:${t.lineHeight};letter-spacing:${t.letterSpacing}px`;}
function sgContrast(a,b){
 const luminance=v=>{const channels=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function sgContrastPairs(s){return [['text','background'],['muted','background'],['accent-text','accent']].flatMap(([fg,bg])=>{const a=s.colors.find(c=>c.id===fg),b=s.colors.find(c=>c.id===bg);return !a||!b?[]:['light','dark'].map(mode=>({label:a.name+' / '+b.name,mode,ratio:sgContrast(a[mode],b[mode])}));});}
function sgUnique(group,s){let id='new-'+group.replace(/s$/,''),i=2;const keys=new Set(s[group].map(r=>r.id));while(keys.has(id))id='new-'+group.replace(/s$/,'')+'-'+i++;return id;}
function sgNew(group,s){const common={id:sgUnique(group,s),name:'',usage:''};if(group==='fonts')return {...common,source:'custom',families:'',fallback:'sans-serif',license:''};if(group==='typography')return {...common,font:s.fonts[0]?.id||'',size:16,unit:'px',weight:400,lineHeight:1.5,letterSpacing:0};if(group==='colors')return {...common,light:'#000000',dark:'#FFFFFF',host:''};if(group==='guidelines')return common;return {...common,value:8,unit:'px'};}

function sgContrastCoverage(s){
 const keys=new Set(s.colors.map(c=>c.id));
 const missing=[['text','background'],['muted','background'],['accent-text','accent']].filter(pair=>pair.some(key=>!keys.has(key))).map(pair=>pair.join(' / '));
 return missing.length?'Not evaluated: '+missing.join('; ')+'. Declare these exact color keys to evaluate all default pairs.':'All 3 default pairs evaluated in light and dark. This is not a full accessibility audit.';
}
