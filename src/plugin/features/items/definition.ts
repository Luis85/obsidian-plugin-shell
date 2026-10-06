import { defineEntity, definePluginDataFeature, fields } from '../api';

const itemEntity = defineEntity('item', 1, {
  label: fields.error(fields.text({ trim: true, min: 1, max: 120 }), 'items.invalid'),
});
export const itemFeature = definePluginDataFeature({ backend: 'plugin-data', entity: itemEntity });
export type ItemInput = Parameters<typeof itemEntity.parse>[0];
export type ItemValues = Extract<ReturnType<typeof itemEntity.parse>, { ok: true }>['value'];
