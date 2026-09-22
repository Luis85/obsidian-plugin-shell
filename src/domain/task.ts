import { failure, success, type Result } from './outcome';
export interface TaskInput { readonly title: string; readonly due: string; readonly tags: string }
export interface Task { readonly title: string; readonly due?: string; readonly tags: readonly string[]; readonly status: 'todo' }
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}
export function parseTask(input: TaskInput): Result<Task> {
  if (!input || typeof input !== 'object' || Object.keys(input).some(key => !['title', 'due', 'tags'].includes(key))) return failure('validation', 'error.entity');
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 120) return failure('validation', 'error.title', 'title');
  if (typeof input.due !== 'string' || (input.due !== '' && !isCalendarDate(input.due))) return failure('validation', 'error.due', 'due');
  if (typeof input.tags !== 'string' || input.tags.length > 300) return failure('validation', 'error.tags', 'tags');
  const tags = [...new Set(input.tags.split(',').map(t => t.trim()).filter(Boolean))];
  if (tags.length > 12 || tags.some(t => !/^[\p{L}\p{N}_/-]+$/u.test(t) || t.length > 40)) return failure('validation', 'error.tags', 'tags');
  return success(Object.freeze({ title: input.title.trim(), status: 'todo', tags: Object.freeze(tags), ...(input.due ? { due: input.due } : {}) }));
}
