import { onScopeDispose, ref } from 'vue';
import { createActionScope, type OperationPermit } from '../../features/api';
import type { NotificationHandle } from '../../application/notification-policy';
import type { ModalOutcome } from '../../application/modal-service';
import { useServices } from '../context/use-services';

/** Optional consumer recipe: availability reads existing work; the service owns recovery. */
export function useRecoveryExample(viewOwner: string) {
  const services = useServices(); const scope = createActionScope();
  const owner = `${viewOwner}:recovery`; const pendingRecovery = ref(false);
  let unregister = () => {}; let progress: NotificationHandle | undefined;
  onScopeDispose(() => {
    scope.dispose(); unregister(); progress?.dismiss(); services.modals.closeOwner(owner);
    services.notices.dismissOwner(owner);
  });
  function beginFeedback(permit: OperationPermit, completion: Promise<ModalOutcome<boolean>>) {
    const stop = services.notices.registerActions(owner, {
      review: {
        labelKey: 'recovery.review',
        async available() { const outcome = await completion; return permit.active() && outcome.status === 'confirmed'; },
        run() {
          if (!permit.active()) return;
          stop();
          if (permit.active()) services.notices.success({ owner, operation: 'reviewed', key: 'recovery.completed', scope: 'view' });
        },
      },
    });
    unregister = stop;
    if (!permit.active()) { stop(); return; }
    services.notices.info({ owner, operation: 'review', key: 'recovery.notice', actions: ['review'], duration: 0, scope: 'view' });
    if (!permit.active()) return;
    const delayed = services.notices.progress({ owner, operation: 'progress', key: 'recovery.waiting', scope: 'view' });
    progress = delayed;
    return { stop, delayed };
  }
  function clearPrevious(permit: OperationPermit): boolean {
    const stop = unregister; const previous = progress; unregister = () => {}; progress = undefined;
    stop(); if (!permit.active()) return false;
    previous?.dismiss(); if (!permit.active()) return false;
    services.notices.dismissOwner(owner); return permit.active();
  }
  function finishRecovery(permit: OperationPermit, feedback: { stop(): void; delayed: NotificationHandle | undefined }, outcome: ModalOutcome<boolean>) {
    feedback.delayed?.dismiss();
    if (!permit.active()) return;
    pendingRecovery.value = false;
    if (outcome.status !== 'confirmed') feedback.stop();
    if (outcome.status === 'failed' && permit.active()) services.notices.error({ owner, operation: 'result', key: outcome.error.key, scope: 'view' });
  }
  async function startRecovery() {
    if (!scope.active() || pendingRecovery.value) return;
    pendingRecovery.value = true; scope.invalidate(); const permit = scope.capture();
    if (!clearPrevious(permit)) return;
    const completion = services.modals.confirm({ owner, titleKey: 'recovery.title', messageKey: 'recovery.help' });
    if (!permit.active()) return;
    const feedback = beginFeedback(permit, completion); if (!feedback) return;
    const outcome = await completion;
    finishRecovery(permit, feedback, outcome);
  }
  return { startRecovery, pendingRecovery };
}
