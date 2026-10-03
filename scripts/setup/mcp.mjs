import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { setupMcpFiles } from '../agent/mcp-config.mjs';
import { createFilePlan } from '../shared/file-plan.ts';

function previousHashes(previous) {
  const values = Array.isArray(previous?.files) ? previous.files : [];
  return new Map(values.filter(item => item && typeof item.path === 'string' && typeof item.afterHash === 'string')
    .map(item => [item.path, item.afterHash]));
}
function requestedAction(value) {
  if (value === true || value === 'enable') return 'enable';
  if (value === 'disable') return 'disable';
  return 'preserve';
}
const receipt = plan => plan.changes.map(({ path, status, beforeHash, afterHash }) => ({ path, status, beforeHash, afterHash }));
export async function planLocalMcp(root, request, previous = null) {
  const action = requestedAction(request);
  const owned = previousHashes(previous);
  if (action === 'preserve') {
    const plan = await createFilePlan(root, []);
    const enabled = previous?.enabled === true;
    return { version: 1, action, enabled, server: 'workbench', transport: 'stdio',
      clients: enabled ? ['claude-code', 'codex'] : [], plan, files: enabled && Array.isArray(previous?.files) ? previous.files : [] };
  }
  if (action === 'disable') {
    const plan = await createFilePlan(root, setupMcpFiles().map(file => ({ path: file.path, content: null })));
    for (const change of plan.changes) {
      if (change.beforeHash !== null && owned.get(change.path) !== change.beforeHash) {
        throw new Error(`MCP_CONFIG_CONFLICT: ${change.path} is edited or not setup-owned; preserve/reconcile it before disabling MCP.`);
      }
    }
    return { version: 1, action, enabled: false, server: 'workbench', transport: 'stdio', clients: [], plan, files: receipt(plan) };
  }
  await access(join(root, 'bin/app'));
  const plan = await createFilePlan(root, setupMcpFiles());
  for (const change of plan.changes) {
    if (change.status === 'update' && owned.get(change.path) !== change.beforeHash) {
      throw new Error(`MCP_CONFIG_CONFLICT: ${change.path} has user or external changes; preserve/reconcile it before setup manages this file.`);
    }
  }
  return { version: 1, action, enabled: true, server: 'workbench', transport: 'stdio',
    clients: ['claude-code', 'codex'], plan, files: receipt(plan) };
}
