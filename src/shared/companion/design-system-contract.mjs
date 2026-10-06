// Shared data-only contract. No CSS input, filesystem, host, DOM or runtime evaluation.
import { DESIGN_SYSTEM_ROLES, designSystemFrontendIssues } from './design-system-roles.mjs';
export const DESIGN_SYSTEM_GROUPS = Object.freeze({fonts:'Fonts',typography:'Typography',spacing:'Spacing',sizes:'Sizes',radii:'Corner radii',colors:'Colors',guidelines:'Usage guidelines'});
export const DESIGN_SYSTEM_FONT_SOURCES = Object.freeze({interface:'Obsidian interface font',text:'Obsidian text font',mono:'Obsidian monospace font',custom:'Named local font stack'});
function dsStyleObject(v,allowed){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));}
function dsStyleText(v,max=1000){return typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);}
function dsStyleId(v){return typeof v==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v)&&v.length<=60&&!['constructor','prototype'].includes(v);}
function dsStyleNumber(v,min,max){return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;}
function dsStyleFontNames(v){return dsStyleText(v,200)&&v.split(',').every(n=>/^[\p{L}\p{N} _-]{1,70}$/u.test(n.trim()));}
export function designSystemIssues(s){
 if(s===undefined)return [];
 if(!dsStyleObject(s,['schema','name','description','principles','frontend',...Object.keys(DESIGN_SYSTEM_GROUPS)])||s.schema!==1||!dsStyleText(s.name,100)||!s.name.trim()||!dsStyleText(s.description,2000)||!dsStyleText(s.principles,4000))return ['Give the design system a name and keep descriptions within their limits.'];
 const errors=[];
 for(const group of Object.keys(DESIGN_SYSTEM_GROUPS)){
  const rows=s[group];if(!Array.isArray(rows)||rows.length>(group==='fonts'?12:64)){errors.push(DESIGN_SYSTEM_GROUPS[group]+': too many or malformed entries.');continue;}
  const ids=new Set();for(const r of rows){
   if(!r||!dsStyleId(r.id)||ids.has(r.id)||!dsStyleText(r.name,100)||!r.name.trim()||!dsStyleText(r.usage,2000)){errors.push(DESIGN_SYSTEM_GROUPS[group]+': use a unique code name, a visible name and a bounded description.');continue;}ids.add(r.id);
   const base=['id','name','usage'];
   if(group==='fonts'){
    if(!dsStyleObject(r,[...base,'source','families','fallback','license'])||!Object.hasOwn(DESIGN_SYSTEM_FONT_SOURCES,r.source)||!['system-ui','sans-serif','serif','monospace'].includes(r.fallback)||!dsStyleText(r.families,200)||!dsStyleText(r.license,1000)||r.source==='custom'&&!dsStyleFontNames(r.families))errors.push(r.name+': specify local family names separated by commas, a fallback and font provenance. URLs, CSS and font files are not accepted.');
   }else if(group==='typography'){
    if(!dsStyleObject(r,[...base,'font','size','unit','weight','lineHeight','letterSpacing'])||!Array.isArray(s.fonts)||!s.fonts.some(f=>f.id===r.font)||!['px','rem'].includes(r.unit)||!dsStyleNumber(r.size,.1,r.unit==='rem'?12:192)||!Number.isInteger(r.weight)||r.weight<100||r.weight>900||!dsStyleNumber(r.lineHeight,1,3)||!dsStyleNumber(r.letterSpacing,-2,10))errors.push(r.name+': choose an existing font, valid size, weight 100–900, line height 1–3 and letter spacing −2–10 px.');
   }else if(['spacing','sizes','radii'].includes(group)){
    if(!dsStyleObject(r,[...base,'value','unit'])||!['px','rem'].includes(r.unit)||!dsStyleNumber(r.value,0,r.unit==='rem'?100:1600))errors.push(r.name+': use a non-negative size with px or rem units (up to 1,600 px / 100 rem).');
   }else if(group==='colors'){
    if(!dsStyleObject(r,[...base,'light','dark','host'])||!/^#[0-9a-f]{6}$/i.test(r.light)||!/^#[0-9a-f]{6}$/i.test(r.dark)||!dsStyleText(r.host,80)||r.host!==''&&(!/^--[a-z][a-z0-9-]*$/.test(r.host)||/^--(?:ui-|ps-|tw-|plugin-shell-)/.test(r.host)||/-ds-/.test(r.host)))errors.push(r.name+': provide six-digit hex colors and an optional CSS variable name, not a CSS expression.');
   }else if(!dsStyleObject(r,base))errors.push(r.name+': unsupported guideline fields.');
  }
 }
 errors.push(...designSystemFrontendIssues(s));
 return errors;
}

export function validateDesignSystem(value, pluginId) {
  let errors;
  try { errors = designSystemIssues(value); } catch { errors = ['Malformed design-system declaration.']; }
  if (pluginId && !errors.length && Array.isArray(value?.colors) && value.colors.some(token => token.host.startsWith('--'+pluginId+'-'))) errors.push('Host colors cannot reference the generated plugin namespace.');
  if (errors.length) throw new Error('DESIGN_SYSTEM_INVALID: ' + errors.join(' '));
  return value;
}
/** Resolves conventional IDs only; explicit null means keep the framework default. */
export function resolveDesignSystemFrontend(system) {
  validateDesignSystem(system);
  const frontend = system?.frontend ?? {schema:1,target:'nuxt-ui',colorPolicy:'host',bindings:{}};
  const bindings = {};
  for (const [role, definition] of Object.entries(DESIGN_SYSTEM_ROLES)) {
    const explicit = Object.hasOwn(frontend.bindings,role);
    let id = explicit ? frontend.bindings[role] : definition.defaults.find(key => system?.[definition.group].some(token => token.id === key)) ?? null;
    if (!explicit && role === 'spacingUnit' && system?.spacing.find(token => token.id === id)?.value === 0) id = null;
    bindings[role] = {group:definition.group,token:id,origin:explicit ? (id === null ? 'inherit' : 'explicit') : (id === null ? 'inherit' : 'convention')};
  }
  return {schema:1,target:'nuxt-ui',colorPolicy:frontend.colorPolicy,bindings};
}
