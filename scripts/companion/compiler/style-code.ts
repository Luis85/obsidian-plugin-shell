import { compileDesignSystem } from '../design-system-css.mjs';
import { json, type Model } from './model.ts';
import type { Add } from './data-code.ts';
/** Managed styles participate in the original plan/hash/ownership transaction. */
export function styleCode(m: Model, add: Add): void {
  const declaration = (m.document.design as Record<string, unknown>).designSystem;
  const output = compileDesignSystem(declaration, String(m.project.id));
  const base = `${m.sourceRoot}/styles`;
  // Always emit the same fragments, including empty systems. Removing a declaration
  // cannot leave a previously generated theme active through a retained import.
  for (const piece of output.pieces) add(`${base}/design-system/${piece.name}.css`,piece.css,'managed');
  add(`${base}/design-system.css`,output.pieces.map(p => `@import "./design-system/${p.name}.css";`).join('\n')+'\n','managed');
  add(`${base}/project.css`,'@import "./layout.css";\n@import "./design-system.css";\n@import "./custom.css";\n','managed');
  add(`${base}/custom.css`,'/* Application-specific overrides. Use owned selectors and design-system variables. */\n');
  add('design/style-manifest.json',json(output.manifest),'managed');
}
