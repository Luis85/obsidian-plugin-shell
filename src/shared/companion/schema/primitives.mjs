/** JSON Schema vocabulary shared by published contracts; no I/O or runtime authority. */
export const reference = name => ({ $ref: '#/$defs/' + name });
export const text = (maxLength, minLength = 0) => ({ type: 'string', minLength, maxLength });
export const choice = values => ({ enum: [...values] });
export const integer = (minimum = 0, maximum = Number.MAX_SAFE_INTEGER - 100001) => ({ type: 'integer', minimum, maximum });
export const number = (minimum, maximum) => ({ type: 'number', minimum, maximum });
export const boolean = { type: 'boolean' };
export const nullable = value => ({ anyOf: [value, { type: 'null' }] });
export const safeKeys = { not: { enum: ['__proto__', 'constructor', 'prototype'] } };
export function record(properties, required = Object.keys(properties), additionalProperties = false) {
  return { type: 'object', properties, required, additionalProperties, propertyNames: safeKeys };
}
export const list = (items, maxItems, minItems = 0) => ({ type: 'array', items, maxItems, minItems });
export const dictionary = (additionalProperties, maxProperties = 120000) => ({ type: 'object', propertyNames: safeKeys, additionalProperties, maxProperties });
export const line = maxLength => ({ ...text(maxLength, 1), pattern: '^[^\\r\\n]*\\S[^\\r\\n]*$' });
export const id = { ...text(120, 1), pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]*$', not: { enum: ['__proto__', 'constructor', 'prototype'] } };
export const key = { ...text(60, 1), pattern: '^[a-z][A-Za-z0-9]*$', not: { enum: ['__proto__', 'constructor', 'prototype'] } };
export const json = reference('json');
export const scalar = { anyOf: [text(8000), { type: 'number' }, boolean, { type: 'null' }] };
export const jsonDefinition = { anyOf: [text(4000000), { type: 'number' }, boolean, { type: 'null' }, list(json, 120000), dictionary(json)] };
