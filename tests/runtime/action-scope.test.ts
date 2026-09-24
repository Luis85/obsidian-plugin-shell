import { describe, expect, it } from 'vitest';
import { createActionScope } from '../../src/features/api';

describe('Author action scope', () => {
  it('FRAMEWORK-OWNER-01 revokes captured work without revoking a live sibling or granting lifecycle controls', () => {
    const owner = createActionScope();
    const sibling = createActionScope();
    const old = owner.capture();
    expect(Object.keys(old)).toEqual(['active']);
    expect(Object.isFrozen(old)).toBe(true);
    expect(old.active()).toBe(true);
    owner.invalidate();
    expect(old.active()).toBe(false);
    expect(owner.active()).toBe(true);
    const current = owner.capture();
    expect(current.active()).toBe(true);
    owner.dispose();
    owner.dispose();
    owner.invalidate();
    expect(current.active()).toBe(false);
    expect(owner.active()).toBe(false);
    expect(owner.capture().active()).toBe(false);
    expect(sibling.capture().active()).toBe(true);
  });
});
