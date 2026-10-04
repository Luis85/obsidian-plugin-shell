import { record, text, line, integer, choice, list, nullable } from './primitives.mjs';
const id = { ...text(4000, 1), pattern: '^[^\\u0000-\\u001f\\u007f]+$' };
const identity = prefix => ({ type: 'string', pattern: '^' + prefix + '-[1-9][0-9]*$' });
const reference = record({ id, label: text(160) });
const surfaces = list(reference, 120);
const story = record({ id: identity('story'), title: line(120), stepId: identity('step'), releaseId: nullable(identity('release')),
  description: text(8000), acceptance: text(8000), ui: choice(['unspecified', 'none', 'surface']), surfaces,
  requirements: list(record({ id, prdId: id, label: text(160) }), 120),
});
story.allOf = [{ if: { properties: { ui: { const: 'none' } } }, then: { properties: { surfaces: { maxItems: 0 } } } }];
export const storymapsSchema = record({ schema: { const: 1 }, nextId: integer(1), maps: list(record({ id: identity('map'), title: line(120),
  purpose: text(4000), audience: text(1000), status: choice(['draft', 'review', 'archived']), revision: integer(1),
  updatedAt: { type: 'string', format: 'date-time', pattern: '^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z$' }, prds: surfaces,
  activities: list(record({ id: identity('activity'), title: line(120), surfaces }), 24),
  steps: list(record({ id: identity('step'), title: line(120), activityId: identity('activity'), surfaces }), 100),
  stories: list(story, 500), releases: list(record({ id: identity('release'), title: line(120), outcome: text(4000) }), 12),
}), 12) });
