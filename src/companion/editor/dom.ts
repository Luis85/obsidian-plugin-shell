const XHTML = 'http://www.w3.org/1999/xhtml';

/** The browser concept has no Obsidian DOM helpers, so detached HTML elements come from the standard namespace API. */
export function htmlElement(doc: Document, tag: string): HTMLElement {
  return doc.createElementNS(XHTML, tag);
}
