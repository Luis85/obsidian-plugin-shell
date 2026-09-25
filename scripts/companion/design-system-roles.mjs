// Deliberately finite semantic roles: imported JSON cannot introduce CSS properties/selectors.
const dsRole = (label, group, defaults, ui = [], shell = []) => ({label,group,defaults,ui,shell});
export const DESIGN_SYSTEM_ROLES = Object.freeze({
  primary:dsRole('Primary accent','colors',['accent'],['primary'],['accent','accent-hover','link','border-focus']),
  secondary:dsRole('Secondary accent','colors',['secondary'],['secondary']),
  success:dsRole('Success','colors',['success'],['success'],['success']),
  info:dsRole('Information','colors',['info'],['info']),
  warning:dsRole('Warning','colors',['warning'],['warning'],['warning']),
  error:dsRole('Error','colors',['error'],['error'],['error']),
  text:dsRole('Body text','colors',['text'],['text'],['text']),
  textMuted:dsRole('Muted text','colors',['muted'],['text-muted','text-toned','text-dimmed'],['text-muted','text-subtle']),
  textHighlighted:dsRole('Highlighted text','colors',['text-highlighted','text'],['text-highlighted']),
  textInverted:dsRole('Text on accent','colors',['accent-text'],['text-inverted'],['text-on-accent']),
  background:dsRole('Background','colors',['background'],['bg'],['surface']),
  backgroundMuted:dsRole('Muted surface','colors',['background-muted','background'],['bg-muted'],['surface-muted']),
  backgroundElevated:dsRole('Raised surface','colors',['background-elevated','background'],['bg-elevated'],['surface-raised']),
  backgroundAccented:dsRole('Hovered surface','colors',['background-accented'],['bg-accented'],['hover']),
  backgroundInverted:dsRole('Inverted surface','colors',['text'],['bg-inverted']),
  border:dsRole('Border','colors',['border'],['border','border-muted'],['border']),
  borderAccented:dsRole('Emphasized border','colors',['border-accented','border'],['border-accented'],['border-hover']),
  borderInverted:dsRole('Inverted border','colors',['text'],['border-inverted']),
  interfaceFont:dsRole('Interface font','fonts',['interface'],[],['font-ui']),
  codeFont:dsRole('Code font','fonts',['code'],[],['font-code']),
  bodyType:dsRole('Body typography','typography',['body']),
  labelType:dsRole('Control / label typography','typography',['label']),
  titleType:dsRole('Page title typography','typography',['page-title']),
  subtitleType:dsRole('Section title typography','typography',['section-title']),
  spacingUnit:dsRole('Tailwind spacing unit (positive)','spacing',['xs']),
  spaceXs:dsRole('Extra-small spacing','spacing',['xs'],[],['space-xs']),
  spaceSm:dsRole('Small spacing','spacing',['sm'],[],['space-sm']),
  spaceMd:dsRole('Medium spacing','spacing',['md'],[],['space-md']),
  spaceLg:dsRole('Large spacing','spacing',['lg'],[],['space-lg']),
  spaceXl:dsRole('Extra-large spacing','spacing',['xl'],[],['space-xl','space-2xl']),
  controlRadius:dsRole('Control corner radius (exact)','radii',['control'],[],['control-radius','radius-sm','radius-md']),
  surfaceRadius:dsRole('Surface corner radius','radii',['surface'],[],['radius-lg']),
  controlHeight:dsRole('Minimum control height','sizes',['control'],[],['control-height']),
  iconSize:dsRole('Icon size','sizes',['icon'],[],['icon-size']),
  inspectorWidth:dsRole('Inspector preferred width','sizes',['inspector']),
});
export function designSystemFrontendIssues(system) {
  const f = system.frontend;
  if (f === undefined) return [];
  const object = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => keys.includes(k));
  if (!object(f,['schema','target','colorPolicy','bindings']) || f.schema !== 1 || f.target !== 'nuxt-ui' || !['host','declared'].includes(f.colorPolicy) || !object(f.bindings,Object.keys(DESIGN_SYSTEM_ROLES))) return ['Nuxt UI styling: expected schema 1, target nuxt-ui, a host/declared palette policy and known binding roles.'];
  const errors = [];
  for (const [role,id] of Object.entries(f.bindings)) {
    const definition = DESIGN_SYSTEM_ROLES[role];
    if (id === null) continue;
    const token = system[definition.group]?.find(t => t?.id === id);
    if (typeof id !== 'string' || !token) errors.push(definition.label + ': select an existing ' + definition.group + ' token or keep the framework default.');
    else if (role === 'spacingUnit' && token.value <= 0) errors.push('Tailwind spacing unit must be positive; other spacing and radius tokens may be zero.');
  }
  return errors;
}
