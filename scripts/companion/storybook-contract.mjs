// Data-only optional namespace for the current authoring/compiler reader.
// The frozen standalone v5 viewer retains its historical contract.
/** @param {unknown} value @returns {{enabled: boolean, generateStories: boolean}} */
export function validateStorybookOptions(value) {
  if (value === undefined) return { enabled: false, generateStories: false };
  const fail = message => { throw new Error('COMPANION_INVALID: design.storybook ' + message); };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('must be an object.');
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('must be plain JSON.');
  for (const key of Object.keys(value)) {
    if (!['enabled', 'generateStories'].includes(key)) fail('does not support ' + key + '.');
    if (typeof value[key] !== 'boolean') fail(key + ' must be a boolean.');
  }
  return { enabled: value.enabled === true, generateStories: value.generateStories === true };
}
