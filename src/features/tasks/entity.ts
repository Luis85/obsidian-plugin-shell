import { defineEntity, fields } from '../api';

export const taskEntity = defineEntity('task', 1, {
  title: fields.error(fields.text({ trim: true, min: 1, max: 120 }), 'error.title'),
  status: fields.defaulted(fields.enum(['todo', 'doing', 'done']), 'todo'),
  tags: fields.error(fields.defaulted(fields.textList({ max: 12, itemMax: 40, pattern: /^[\p{L}\p{N}_/-]+$/u }), []), 'error.tags'),
  due: fields.error(fields.optional(fields.date()), 'error.due'),
});
export type TaskCreateInput = Parameters<typeof taskEntity.parse>[0];
export type TaskValues = Extract<ReturnType<typeof taskEntity.parse>, { ok: true }>['value'];
