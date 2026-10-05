/**
 * Stable failures of the Increment and PullRequest documents. The message starts with `CODE:` (the DocsError
 * convention) so framework `failure()` keeps the code; adapters map codes to `next` hints.
 */
export type IncrementErrorCode =
  | 'INCREMENT_NOT_FOUND' | 'INCREMENT_EXISTS' | 'INCREMENT_ID_INVALID' | 'INCREMENT_DOCUMENT_INVALID' | 'INCREMENT_STATUS_TRANSITION'
  | 'INCREMENT_NOT_READY' | 'INCREMENT_OPEN_PULL_REQUESTS' | 'INCREMENT_LOCKED' | 'INCREMENT_LINK_DRIFT' | 'INCREMENT_INPUT_INVALID'
  | 'INCREMENT_SECTION_UNKNOWN' | 'INCREMENT_AC_NOT_FOUND' | 'INCREMENT_OWNER_REQUIRED' | 'INCREMENT_GATES_UNAVAILABLE';
export type DeliveryPathErrorCode = 'DELIVERY_PATHS_DRIFT' | 'DELIVERY_SCHEMA_UNSUPPORTED' | 'WIKILINK_UNRESOLVED' | 'WIKILINK_AMBIGUOUS' | 'BRANCH_NAME_INVALID';
export type IssueErrorCode =
  | 'ISSUE_NOT_FOUND' | 'ISSUE_EXISTS' | 'ISSUE_ID_INVALID' | 'ISSUE_DOCUMENT_INVALID' | 'ISSUE_STATUS_TRANSITION' | 'ISSUE_LOCKED'
  | 'ISSUE_INCREMENT_REQUIRED' | 'ISSUE_CRITERION_NOT_FOUND';
export type PullRequestErrorCode =
  | 'PR_NOT_FOUND' | 'PR_EXISTS' | 'PR_ID_INVALID' | 'PR_INCREMENT_REQUIRED' | 'PR_LOCKED' | 'PR_LOCKED_REGION_EDITED' | 'PR_TERMINAL'
  | 'PR_NOT_PUBLISHED' | 'PR_ALREADY_PUBLISHED' | 'PR_TASK_NOT_FOUND' | 'PR_LIMIT' | 'PR_STATUS_TRANSITION' | 'PR_DOCUMENT_INVALID' | 'PR_BASE_MISMATCH';
export type DeliveryErrorCode = IncrementErrorCode | DeliveryPathErrorCode | PullRequestErrorCode | IssueErrorCode;

export class DeliveryDocumentError extends Error {
  readonly code: DeliveryErrorCode;
  readonly details: Record<string, unknown> | undefined;
  constructor(code: DeliveryErrorCode, message: string, details?: Record<string, unknown>) {
    super(`${code}: ${message}`); this.name = 'DeliveryDocumentError'; this.code = code; this.details = details;
  }
}
export function insistDelivery(condition: unknown, code: DeliveryErrorCode, message: string, details?: Record<string, unknown>): asserts condition {
  if (!condition) throw new DeliveryDocumentError(code, message, details);
}
