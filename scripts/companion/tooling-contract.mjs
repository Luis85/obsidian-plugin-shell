/** Inert optional development settings. No package, process or host is acquired here. */
export const AIRSHIP_VERSION = '0.3.0';
const AIRSHIP_DEFAULTS = Object.freeze({ enabled: false, agent: 'claude', targetPort: 5173, port: 5174 });
function requireTooling(condition, message) {
  if (!condition) throw new Error('COMPANION_TOOLING_INVALID: ' + message);
}
/** Inspect descriptors before reading values; settings cannot acquire capabilities through accessors. */
function fields(value, allowed) {
  requireTooling(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'Expected plain development tooling settings.');
  requireTooling(Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key)), 'Unknown development tooling field.');
  requireTooling(Object.values(Object.getOwnPropertyDescriptors(value)).every(field =>
    Object.hasOwn(field, 'value') && field.enumerable), 'Tooling settings must contain only enumerable data fields.');
}
export function validateTooling(value) {
  if (value === undefined) return;
  fields(value, ['airship', 'storybook']);
  if (Object.hasOwn(value, 'storybook')) {
    fields(value.storybook, ['enabled', 'generateStories']);
    requireTooling(Object.values(value.storybook).every(item => typeof item === 'boolean'),
      'tooling.storybook accepts only boolean enabled and generateStories switches. Both default to false.');
  }
  if (!Object.hasOwn(value, 'airship')) return;
  const item = value.airship;
  fields(item, ['enabled', 'agent', 'targetPort', 'port']);
  requireTooling(typeof item.enabled === 'boolean', 'Airship enabled must be a boolean.');
  requireTooling(item.agent === undefined || ['claude', 'codex', 'opencode'].includes(item.agent), 'Unsupported Airship agent.');
  for (const key of ['targetPort', 'port']) requireTooling(item[key] === undefined ||
    (Number.isInteger(item[key]) && item[key] >= 1024 && item[key] <= 65535), key + ' must be an unprivileged TCP port.');
  requireTooling((item.targetPort ?? AIRSHIP_DEFAULTS.targetPort) !== (item.port ?? AIRSHIP_DEFAULTS.port), 'Preview and proxy ports must differ.');
}
/** @returns {{enabled: boolean, agent: 'claude'|'codex'|'opencode', targetPort: number, port: number}} */
export function airshipOptions(tooling) {
  validateTooling(tooling);
  return { ...AIRSHIP_DEFAULTS, ...tooling?.airship };
}
/** Upstream accepts these fields. Imported documents cannot supply commands, paths, hosts or permissions. */
export function airshipConfig(tooling) {
  const options = airshipOptions(tooling);
  return { target: options.targetPort, port: options.port, host: '127.0.0.1', agent: options.agent,
    mode: 'canvas', safe: true, commit: false, open: false };
}
export function toolingSchema() {
  return { type: 'object', additionalProperties: false, properties: { storybook: {
    type: 'object', additionalProperties: false, properties: {
      enabled: { type: 'boolean', default: false, description: 'Emit an isolated Storybook workspace; installation is a separate explicit action.' },
      generateStories: { type: 'boolean', default: false, description: 'Emit CSF stories for generated pages and components without installing Storybook.' },
    },
  }, airship: {
    type: 'object', additionalProperties: false, required: ['enabled'], properties: {
      enabled: { type: 'boolean', default: false }, agent: { enum: ['claude', 'codex', 'opencode'], default: 'claude' },
      targetPort: { type: 'integer', minimum: 1024, maximum: 65535, default: 5173 },
      port: { type: 'integer', minimum: 1024, maximum: 65535, default: 5174 },
    }, description: 'Opt-in only. Ports must differ. Installation and launch require separate explicit commands.',
  } } };
}
