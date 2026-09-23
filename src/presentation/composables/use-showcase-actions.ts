import { useI18n } from 'vue-i18n';
import { onScopeDispose } from 'vue';
import { failure, success } from '../../domain/outcome';
import type { ModalOutcome } from '../../application/modal-service';
import { useServices } from '../context/use-services';
import { useShowcase } from '../stores/showcase';

export function useShowcaseActions() {
  const { t } = useI18n();
  const services = useServices();
  const model = useShowcase();
  const owner = `${model.owner}:modal`; let alive = true;
  onScopeDispose(() => { alive = false; services.modals.closeOwner(owner); services.notices.dismissOwner(owner); });
  function ping() { services.showcase.ping(model.eventCount + 1); }
  function notice() { services.notices.info({ owner: `${model.owner}:showcase-notice`, operation: 'example', key: 'feedback.native', native: true, scope: 'view' }); }
  function expected() { services.notices.error({ owner: `${model.owner}:showcase-example`, operation: 'example', key: 'events.expected', native: false, scope: 'view' }); }
  function result(outcome: ModalOutcome<unknown>, announce = true) {
    if (!alive) return;
    if (outcome.status === 'failed') services.notices.error({ owner, operation: 'result', key: outcome.error.key, native: false, scope: 'view' });
    else if (announce) services.notices.info({ owner, operation: 'result', key: outcome.status === 'confirmed' ? 'modal.confirmed' : 'modal.cancelled', native: false, scope: 'view' });
  }
  async function modal() { if (alive) result(await services.modals.info({ owner, titleKey: 'modal.title', messageKey: 'modal.text' }), false); }
  async function confirm() { if (alive) result(await services.modals.confirm({ owner, titleKey: 'modal.confirmTitle', messageKey: 'modal.confirmText' })); }
  async function prompt() {
    if (!alive) return;
    result(await services.modals.prompt({ owner, titleKey: 'modal.promptTitle', messageKey: 'modal.promptText', maxLength: 80,
      validate: value => value.trim() ? success(value.trim()) : failure('validation', 'modal.invalid') }));
  }
  return { t, ping, notice, expected, modal, confirm, prompt };
}
