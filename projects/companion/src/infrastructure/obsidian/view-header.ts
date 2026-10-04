import type { PreferenceService } from '../../application/preference-service';
import type { ErrorReporter, Unsubscribe } from '../../application/ports';
import { pluginIdentity } from '../plugin-identity';

export const SHOWCASE_VIEW = pluginIdentity.viewType;
const hiddenClass = pluginIdentity.hiddenHeaderClass;
/** The public View API has no header-visibility setter. Own only this view's marker.
 * The direct-child selector deliberately excludes tabs, OS chrome and other leaves.
 * No style/hidden attributes are overwritten; removing our marker restores host CSS.
 */
export function bindViewHeader(container: HTMLElement, preferences: PreferenceService, errors: ErrorReporter, ownedType: string = SHOWCASE_VIEW): Unsubscribe {
  const prefix = `${pluginIdentity.id}-view-`;
  const explicitType = ownedType === SHOWCASE_VIEW || (ownedType.startsWith(prefix) && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(ownedType.slice(prefix.length)));
  if (!explicitType || container.getAttribute('data-type') !== ownedType) throw new Error('HEADER_OWNER_MISMATCH');
  const originalOwner = container.getAttribute('data-plugin-view-owner');
  const original = container.classList.contains(hiddenClass);
  const hadClassAttribute = container.hasAttribute('class');
  const restore = () => {
    container.classList.toggle(hiddenClass, original);
    if (!hadClassAttribute && !container.classList.length) container.removeAttribute('class');
    if (originalOwner === null) container.removeAttribute('data-plugin-view-owner');
    else container.setAttribute('data-plugin-view-owner', originalOwner);
  };
  let disposed = false;
  let reported = false;
  const apply = () => {
    if (disposed) return;
    const supported = !!container.querySelector(':scope > .view-header');
    if (!supported && !reported) { reported = true; errors.report('header.unsupported', 'view.header'); }
    const hidden = supported && preferences.current.hideObsidianViewHeader;
    if (container.classList.contains(hiddenClass) !== hidden) container.classList.toggle(hiddenClass, hidden);
  };
  const Observer = container.ownerDocument.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(apply) : undefined;
  const stop = preferences.subscribe(apply);
  try { if (ownedType !== SHOWCASE_VIEW) container.setAttribute('data-plugin-view-owner', pluginIdentity.id); apply(); observer?.observe(container, { childList: true }); }
  catch (error) { stop(); observer?.disconnect(); restore(); throw error; }
  return () => {
    if (disposed) return;
    disposed = true; stop(); observer?.disconnect();
    restore();
  };
}
