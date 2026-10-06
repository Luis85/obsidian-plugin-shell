/**
 * Scoped workflow allowances for the delivery pipeline (owner-requested). Every workflow keeps read-only
 * top-level permissions. Only the files named in `privilegedWorkflows` may grant a job write scopes, and only
 * when they are dispatch-only and every write job targets the reviewer-protected `release` environment.
 * A job may call a repository-local reusable workflow by exact file name; checkRepository confirms that the
 * target exists and declares `on.workflow_call`.
 */
export const privilegedWorkflows = Object.freeze(['release-cut.yml', 'publish.yml']);
const releaseEnvironment = 'release';
const localWorkflow = /^\.\/\.github\/workflows\/([a-z0-9]+(?:-[a-z0-9]+)*\.ya?ml)$/;

/** The workflow file a job-level `uses:` calls, or null when it is not an exact repository-local reference. */
export function localWorkflowCall(value) {
  const match = typeof value === 'string' ? localWorkflow.exec(value) : null;
  return match ? match[1] : null;
}
function workflowTriggers(on) {
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  return on && typeof on === 'object' ? Object.keys(on) : [];
}
export const callableWorkflow = on => workflowTriggers(on).includes('workflow_call');

/** Throws unless every scope is read/none (or also write when `allowWrite`); returns whether any scope writes. */
export function checkPermissions(value, allowWrite = false) {
  const allowed = allowWrite ? ['read', 'write', 'none'] : ['read', 'none'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => !allowed.includes(item))) throw new Error('WORKFLOW_PERMISSIONS_NOT_READ_ONLY');
  return Object.values(value).includes('write');
}
const environmentName = value => typeof value === 'string' ? value : value && typeof value === 'object' ? value.name : undefined;

/** Job-level rules: write scopes only in an allowlisted file and only behind the release environment. */
export function inspectJobPrivileges(job, privileged) {
  if (privileged && job.uses) throw new Error('PRIVILEGED_WORKFLOW_CALL_FORBIDDEN');
  if (job.uses && job.secrets !== undefined) throw new Error('WORKFLOW_CALL_SECRETS_FORBIDDEN');
  if (job.permissions === undefined) return;
  const writes = checkPermissions(job.permissions, privileged);
  if (writes && environmentName(job.environment) !== releaseEnvironment) throw new Error('PRIVILEGED_JOB_WITHOUT_ENVIRONMENT');
}

/** Workflow-level rules for an allowlisted file: manual dispatch is its only trigger. */
export function inspectWorkflowPrivileges(data, privileged) {
  if (!privileged) return;
  const triggers = workflowTriggers(data.on);
  if (triggers.length !== 1 || triggers[0] !== 'workflow_dispatch') throw new Error('PRIVILEGED_WORKFLOW_TRIGGER_FORBIDDEN');
}
