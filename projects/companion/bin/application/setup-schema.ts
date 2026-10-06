import { settingsSchema } from '../domain/user-settings.ts';
import { sketchSchema } from './schema.ts';
const prose = { type: 'string', minLength: 1, maxLength: 1000 };
export const setupSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'New Angular project setup', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'project', 'prds', 'prototypeInterview', 'operations', 'boilerplate'],
  properties: {
    schemaVersion: { const: 1 }, settings: settingsSchema,
    project: { type: 'object', additionalProperties: false, required: ['name', 'description', 'product'], properties: {
      name: { type: 'string', minLength: 1, maxLength: 80 }, description: { ...prose, maxLength: 400 }, product: prose,
    } },
    prds: { oneOf: [
      { type: 'object', additionalProperties: false, required: ['mode'], properties: { mode: { const: 'scan' } } },
      { type: 'object', additionalProperties: false, required: ['mode'], properties: { mode: { const: 'add' },
        files: { type: 'array', maxItems: 12, items: { type: 'string' } }, documents: { type: 'array', maxItems: 12, items: {
          type: 'object', additionalProperties: false, required: ['filename', 'markdown'], properties: {
            filename: { type: 'string' }, markdown: { type: 'string', maxLength: 250000 },
          },
        } },
      } },
    ] },
    prototypeInterview: { oneOf: [{ type: 'null' }, { type: 'object', additionalProperties: false,
      required: ['schemaVersion', 'guideId', 'guideVersion', 'answers'], properties: { schemaVersion: { const: 1 },
        guideId: { type: 'string' }, guideVersion: { type: 'integer', minimum: 1 }, answers: { type: 'object' } },
      description: 'Discover project-setup guide; submit explicitly approved answers, or null to skip.',
    }] },
    operations: sketchSchema.properties.operations, boilerplate: { type: 'boolean' },
  },
};
export const setupExample = { schemaVersion: 1, project: { name: 'Example product', description: 'Our next Angular application.', product: 'Help users manage their work.' },
  prds: { mode: 'scan' }, prototypeInterview: null, operations: [], boilerplate: true };
