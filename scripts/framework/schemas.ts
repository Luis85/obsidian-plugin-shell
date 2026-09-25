import { commands } from './catalog.ts';
/** These describe transport shape, not trust, filesystem containment or business readiness. */
export function operationSchemas() {
  const common = { root: { type: 'string' }, json: { const: true }, help: { const: true }, 'no-interaction': { const: true }, yes: { const: true }, 'dry-run': { const: true }, apply: { type: 'string', pattern: '^[a-f0-9]{64}$' }, 'plan-out': { type: 'string' }, timeout: { type: 'string', pattern: '^[0-9]+$' } };
  return { protocolVersion: 1, request: { $schema: 'https://json-schema.org/draft/2020-12/schema', oneOf: commands.map(command => ({
    type: 'object', additionalProperties: false, required: ['command', 'args', 'options'],
    properties: { command: { const: command.id }, args: { type: 'array', maxItems: command.maxArgs, items: { type: 'string', maxLength: 4096 } }, options: {
      type: 'object', additionalProperties: false, properties: { ...common, ...Object.fromEntries(Object.entries(command.options).map(([name, type]) => [name, type === 'flag' ? { const: true } : { type: 'string', maxLength: 4096 }])) },
    } },
  })) }, result: { type: 'object', additionalProperties: false, required: ['protocolVersion', 'command', 'status', 'data', 'diagnostics'], properties: {
    protocolVersion: { const: 1 }, command: { type: 'string' }, status: { enum: ['ok', 'planned', 'applied', 'unchanged', 'blocked', 'cancelled', 'failed'] }, data: {},
    diagnostics: { type: 'array', items: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' }, next: { type: 'string' } }, additionalProperties: false } },
  } } };
}
