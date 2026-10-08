import { record, text, integer, number, choice, list, nullable } from './primitives.mjs';
import { DESIGN_SYSTEM_ROLES } from '../design-system-roles.mjs';
const words = max => ({ ...text(max), pattern: '^[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]*$' });
const id = { ...text(60, 1), pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$', not: { enum: ['constructor', 'prototype'] } };
const base = { id, name: { ...words(100), minLength: 1, allOf: [{ pattern: '\\S' }] }, usage: words(2000) };
const unitRule = (field, maximum) => ({ if: { properties: { unit: { const: 'rem' } } }, then: { properties: { [field]: { maximum } } } });
const size = { ...record({ ...base, value: number(0, 1600), unit: choice(['px', 'rem']) }), allOf: [unitRule('value', 100)] };
const font = record({ ...base, source: choice(['interface', 'text', 'mono', 'custom']), families: words(200), fallback: choice(['system-ui', 'sans-serif', 'serif', 'monospace']), license: words(1000) });
const type = { ...record({ ...base, font: id, size: number(.1, 192), unit: choice(['px', 'rem']), weight: integer(100, 900), lineHeight: number(1, 3), letterSpacing: number(-2, 10) }), allOf: [unitRule('size', 12)] };
const color = record({ ...base, light: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, dark: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  host: { ...words(80), anyOf: [{ const: '' }, { pattern: '^--[a-z][a-z0-9-]*$', not: { anyOf: [{ pattern: '^--(ui-|ps-|tw-|plugin-shell-)' }, { pattern: '-ds-' }] } }] },
});
export const designSystemSchema = record({ schema: { const: 1 }, name: { ...words(100), minLength: 1, allOf: [{ pattern: '\\S' }] },
  description: words(2000), principles: words(4000), fonts: list(font, 12), typography: list(type, 64), spacing: list(size, 64), sizes: list(size, 64), radii: list(size, 64),
  colors: list(color, 64), guidelines: list(record(base), 64), frontend: record({ schema: { const: 1 }, target: { const: 'nuxt-ui' },
    colorPolicy: choice(['host', 'declared']), bindings: record(Object.fromEntries(Object.keys(DESIGN_SYSTEM_ROLES).map(role => [role, nullable(id)])), []),
  }),
}, ['schema', 'name', 'description', 'principles', 'fonts', 'typography', 'spacing', 'sizes', 'radii', 'colors', 'guidelines']);
