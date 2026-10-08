/** Read-only permission to begin work. It cannot cancel persistence already in flight. */
export interface OperationPermit { active(): boolean }
export interface ActionScope extends OperationPermit {
  capture(): OperationPermit;
  invalidate(): void;
  dispose(): void;
}

/** One owner, many operations; invalidation also rejects older asynchronous completions. */
export function createActionScope(): ActionScope {
  let alive = true;
  let generation = 0;
  return Object.freeze({
    active: () => alive,
    capture() {
      const captured = generation;
      return Object.freeze({ active: () => alive && captured === generation });
    },
    invalidate() { generation++; },
    dispose() { alive = false; generation++; },
  });
}
