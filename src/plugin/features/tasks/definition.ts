import { defineDocument, defineNoteFeature, heading } from '../api';
import { taskEntity } from './entity';

export const taskDocument = defineDocument(taskEntity, {
  mappings: [{ field: 'title', property: 'title' }, { field: 'status', property: 'status' }, { field: 'tags', property: 'tags' }, { field: 'due', property: 'due' }],
  title: value => value.title,
  body: value => `# ${heading(value.title)}\n\n## Notes\n\n`,
});
export const taskFeature = defineNoteFeature({ document: taskDocument, defaultFolder: 'Tasks' });
