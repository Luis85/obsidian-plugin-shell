import { defineEntity, fields } from '../api';

export const projectEntity = defineEntity('project', 1, {
  name: fields.text({ trim: true, min: 1, max: 120 }),
  budget: fields.defaulted(fields.number({ min: 0 }), 0),
  archived: fields.defaulted(fields.boolean(), false),
});
