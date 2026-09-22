import type { Locator } from '@playwright/test';
/** Chromium's native menulist reports line-height: normal even for an author value.
 * Measure the selected glyphs, rather than treating parseFloat('normal') as evidence.
 */
export async function controlMetrics(control: Locator) {
  return control.evaluate(el => {
    const css = getComputedStyle(el);
    const canvas = el.ownerDocument.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || !(el instanceof HTMLSelectElement)) throw new Error('MISSING_SELECT_METRICS');
    context.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    const text = context.measureText(el.selectedOptions[0]?.text ?? 'Language');
    const glyphHeight = text.actualBoundingBoxAscent + text.actualBoundingBoxDescent;
    return { height: el.clientHeight, padding: parseFloat(css.paddingTop) + parseFloat(css.paddingBottom),
      glyphHeight, lineHeight: css.lineHeight, fontSize: css.fontSize, overflow: css.overflow };
  });
}
