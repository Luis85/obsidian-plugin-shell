import type { Unsubscribe } from '../../application/ports';
export type ObserveOwnerChange = (refresh: () => void) => Unsubscribe;
/** Observe the root's current document, not the window that happened to mount it. */
export function bindHostTheme(root: HTMLElement, observeOwner?: ObserveOwnerChange): Unsubscribe {
  const original = { dark: root.classList.contains('dark'), light: root.classList.contains('light') };
  let document: Document | undefined;
  let observer: MutationObserver | undefined;
  let closed = false;
  const refresh = () => {
    if (closed) return;
    const owner = root.ownerDocument;
    if (owner !== document) {
      observer?.disconnect(); document = owner;
      const Observer = owner.defaultView?.MutationObserver;
      if (!Observer) throw new Error('VIEW_DOCUMENT_UNAVAILABLE');
      observer = new Observer(refresh);
      observer.observe(owner.body, { attributes: true, attributeFilter: ['class'] });
    }
    const dark = owner.body.classList.contains('theme-dark');
    root.classList.toggle('dark', dark); root.classList.toggle('light', !dark);
  };
  let stop: Unsubscribe | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    try { observer?.disconnect(); stop?.(); }
    finally { root.classList.toggle('dark', original.dark); root.classList.toggle('light', original.light); }
  };
  try { refresh(); stop = observeOwner?.(refresh); return close; }
  catch (error) { close(); throw error; }
}
