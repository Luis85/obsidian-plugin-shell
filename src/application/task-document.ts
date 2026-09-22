import { parseTask, type TaskInput } from '../domain/task';
import { success } from '../domain/outcome';
import type { DocumentDefinition } from './document-service';
export interface EntityInputs { task: TaskInput }
export const taskDefinition: DocumentDefinition<TaskInput> = {
  project(input) {
    const parsed = parseTask(input);
    if (!parsed.ok) return parsed;
    const { title, status, tags, due } = parsed.value;
    // Explicit projection: new internal fields are never automatically exposed.
    return success({ title, properties: { title, status, tags, ...(due ? { due } : {}) }, body: `# ${title.replace(/[\r\n]/g, ' ')}\n\n## Notes\n\n` });
  },
};
