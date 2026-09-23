import { defineDocument, defineNoteFeature, heading } from '../api';
import { projectEntity } from './entity';

export const projectDocument = defineDocument(projectEntity, {
  mappings: [{ field: 'name', property: 'name' }, { field: 'budget', property: 'budget' }, { field: 'archived', property: 'archived' }],
  title: value => value.name,
  body: value => `# ${heading(value.name)}\n\n## Notes\n\n`,
});
export const projectFeature = defineNoteFeature({ document: projectDocument, defaultFolder: 'Projects' });
