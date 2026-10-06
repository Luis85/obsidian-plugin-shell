import { defineEvent } from '../api';
import type { ShellEvents } from '../../application/events';
import { record, natural } from '../../application/event-definitions/validation';
export const showcasePing = defineEvent(
  'showcase.ping',
  (value: unknown): value is ShellEvents['showcase.ping'] => record(value, ['sequence']) && natural(value.sequence),
);
