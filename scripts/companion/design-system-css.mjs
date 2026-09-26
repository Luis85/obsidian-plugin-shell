import { DESIGN_SYSTEM_ROLES } from './design-system-roles.mjs';
import { resolveDesignSystemFrontend } from './design-system-contract.mjs';
// Identical browser/CLI compiler. No remote assets, arbitrary CSS, eval or generated JS.
const dsGroups = ['fonts','typography','spacing','sizes','radii','colors'];
function dsFontValue(font) {
  const native = {interface:'--font-interface',text:'--font-text',mono:'--font-monospace'};
  return font.source === 'custom'
    ? font.families.split(',').map(name => JSON.stringify(name.trim())).join(', ') + ', ' + font.fallback
    : `var(${native[font.source]}, ${font.fallback})`;
}
function dsRule(selector, declarations) {
  return declarations.length ? `${selector} {\n${declarations.map(d => '  '+d+';').join('\n')}\n}\n` : '';
}
function dsTypeDeclarations(ref, id) {
  return ['font-family','font-size','font-weight','line-height','letter-spacing'].map((p,i) => `${p}: ${ref('typography',id,['font','size','weight','line-height','tracking'][i])}`);
}
export function compileDesignSystem(system, pluginId) {
  if (typeof pluginId !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(pluginId) || pluginId.length > 60 || ['constructor','prototype'].includes(pluginId)) throw new Error('DESIGN_SYSTEM_SCOPE: Invalid plugin ID.');
  const frontend = resolveDesignSystemFrontend(system);
  const scope = `[data-plugin-ui="${pluginId}"].ps--${pluginId}`;
  const variable = (group,id,part='') => `--${pluginId}-ds-${group}-${id}${part ? '-'+part : ''}`;
  const ref = (group,id,part='') => `var(${variable(group,id,part)})`;
  const pieces = [];
  const header = '/* Generated design system. Edit saved tokens, not this managed file. */\n';
  const add = (name,css) => pieces.push({name,css:header+css});
  const sorted = group => [...(system?.[group] ?? [])].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const group of dsGroups) {
    const light = [], dark = [], helpers = [];
    for (const token of sorted(group)) {
      const name = variable(group,token.id);
      const selector = `${scope} .${pluginId}-ds-${group}-${token.id}`;
      if (group === 'fonts') {
        light.push(`${name}: ${dsFontValue(token)}`);
        helpers.push(`${selector} { font-family: ${ref(group,token.id)}; }`);
      } else if (group === 'typography') {
        // One line per token keeps the bounded 64-token fragment below the CSS line ceiling.
        light.push(`${name}-font: ${ref('fonts',token.font)}; ${name}-size: ${token.size}${token.unit}; ${name}-weight: ${token.weight}; ${name}-line-height: ${token.lineHeight}; ${name}-tracking: ${token.letterSpacing}px`);
        helpers.push(`${selector} { ${dsTypeDeclarations(ref,token.id).join('; ')}; }`);
      } else if (group === 'colors') {
        if (token.host && (/^--(?:ui-|ps-|tw-|plugin-shell-)/.test(token.host) || token.host.startsWith('--'+pluginId+'-') || /-ds-/.test(token.host))) throw new Error('DESIGN_SYSTEM_COLOR_CYCLE: Color host reference must not point to generated/framework tokens.');
        for (const [mode,rows] of [['light',light],['dark',dark]]) rows.push(`${name}: ${frontend.colorPolicy === 'host' && token.host ? `var(${token.host}, ${token[mode]})` : token[mode]}`);
        helpers.push(`${selector} { color: ${ref(group,token.id)}; }`);
        helpers.push(`${scope} .${pluginId}-ds-bg-${token.id} { background-color: ${ref(group,token.id)}; }`);
        helpers.push(`${scope} .${pluginId}-ds-border-${token.id} { border-color: ${ref(group,token.id)}; }`);
      } else {
        light.push(`${name}: ${token.value}${token.unit}`);
        const property = group === 'spacing' ? 'gap' : group === 'radii' ? 'border-radius' : 'width';
        helpers.push(`${selector} { ${property}: ${ref(group,token.id)}; }`);
        if (group === 'spacing') helpers.push(`${scope} .${pluginId}-ds-padding-${token.id} { padding: ${ref(group,token.id)}; }`);
        if (group === 'sizes') helpers.push(`${scope} .${pluginId}-ds-height-${token.id} { height: ${ref(group,token.id)}; }`);
      }
    }
    add(group, dsRule(scope,light) + dsRule(scope+'.dark',dark) + helpers.join('\n') + '\n');
  }
  const declarations = [], rules = [];
  const bound = role => frontend.bindings[role].token;
  const roleRef = role => ref(frontend.bindings[role].group,bound(role));
  const set = (property,value) => declarations.push(`${property}: ${value}`);
  for (const [role,definition] of Object.entries(DESIGN_SYSTEM_ROLES)) {
    if (!bound(role)) continue;
    for (const key of definition.ui) set('--ui-'+key,roleRef(role));
    for (const key of definition.shell) set('--'+pluginId+'-'+key,roleRef(role));
  }
  if (bound('interfaceFont')) { set('--ps-font-sans',roleRef('interfaceFont')); set('font-family',roleRef('interfaceFont')); }
  if (bound('codeFont')) {
    set('--ps-font-mono',roleRef('codeFont'));
    rules.push(`${scope} :is(code,pre,kbd,samp) { font-family: ${roleRef('codeFont')}; }`);
  }
  for (const [role,selector,tailwind] of [['bodyType',scope+', '+scope+' :is(.shell-app,.shell-lead,.shell-capability p,.shell-flow-card p,.generated-workbench)','base'],['labelType',`${scope} :is(label,button,input,select,textarea)`,'sm'],['titleType',`${scope} h1`,'2xl'],['subtitleType',`${scope} :is(h2,h3)`,'lg']]) {
    const id = bound(role); if (!id) continue;
    const typeRef = part => ref('typography',id,part);
    set('--ps-text-'+tailwind,typeRef('size')); set('--ps-text-'+tailwind+'--line-height',typeRef('line-height'));
    if (role === 'bodyType') {
      set('--'+pluginId+'-text-size',typeRef('size')); set('--'+pluginId+'-weight-normal',typeRef('weight')); set('--'+pluginId+'-line-height',typeRef('line-height'));
    }
    if (role === 'labelType') { set('--'+pluginId+'-text-size-sm',typeRef('size')); set('--'+pluginId+'-weight-strong',typeRef('weight')); }
    rules.push(dsRule(selector,dsTypeDeclarations(ref,id)));
  }
  if (bound('spacingUnit')) {
    const token = system.spacing.find(t => t.id === bound('spacingUnit'));
    if (token.value <= 0) throw new Error('DESIGN_SYSTEM_SPACING: Tailwind spacing unit must be positive; choose a different binding or keep the framework default.');
    set('--ps-spacing',roleRef('spacingUnit'));
  }
  if (bound('controlRadius')) {
    // Nuxt UI rounded-md is 1.5 times --ui-radius. Bind the exact control radius,
    // while retaining Nuxt's relative radius scale for the remaining components.
    set('--ui-radius',`calc(${roleRef('controlRadius')} / 1.5)`);
    rules.push(`${scope} :is(button,input,select,textarea) { border-radius: ${roleRef('controlRadius')}; }`);
  }
  if (bound('surfaceRadius')) rules.push(`${scope} :is(.shell-capability,.shell-settings-card,.shell-preview,.generated-component) { border-radius: ${roleRef('surfaceRadius')}; }`);
  if (bound('controlHeight')) rules.push(`${scope} :is(button,input:not([type="checkbox"]):not([type="radio"]),select) { min-height: ${roleRef('controlHeight')}; }`);
  if (bound('iconSize')) rules.push(`${scope} :is([data-slot="leadingIcon"],[data-slot="trailingIcon"]) { width: ${roleRef('iconSize')}; height: ${roleRef('iconSize')}; }`);
  if (bound('inspectorWidth')) {
    set('--'+pluginId+'-inspector-width',roleRef('inspectorWidth'));
    rules.push(`${scope} [data-ds-layout="inspector"] { width: ${roleRef('inspectorWidth')}; max-width: 100%; min-width: 0; }`);
  }
  if (bound('text')) set('color',roleRef('text'));
  if (bound('background')) set('background-color',roleRef('background'));
  if (bound('primary')) {
    set('accent-color',roleRef('primary'));
    rules.push(`${scope} :focus-visible { outline-color: ${roleRef('primary')}; }`);
  }
  for (const role of ['primary','secondary','success','info','warning','error']) if (bound(role)) rules.push(`${scope} [class~="ps:text-${role}"] { color: var(--ui-${role}); }`);
  add('theme',dsRule(scope,declarations)+rules.join('\n')+'\n');
  const manifest = {schema:1,compiler:'companion-design-system/1',target:'nuxt-ui-vue',pluginId,scope,colorPolicy:frontend.colorPolicy,bindings:frontend.bindings,
    tokens:Object.fromEntries(dsGroups.map(group => [group,sorted(group).map(t => ({id:t.id,variables:(group === 'typography' ? ['font','size','weight','line-height','tracking'].map(part => variable(group,t.id,part)) : [variable(group,t.id)]),className:`${pluginId}-ds-${group}-${t.id}`}))])),
    notes:['Guidelines remain documentation, not executable styling.','Fonts reference local/host families only.','Unbound semantic roles retain framework defaults.','Nuxt variants retain their interaction behavior and relative radius scale.']};
  return {css:pieces.map(p => p.css).join('\n'),pieces,manifest};
}
