import type { Model } from '../../../scripts/companion/compiler/model.ts';
import { visualDefinitions, visualPackages } from '../../../scripts/companion/compiler/visual-model.ts';
import { visualNodes } from '../../../scripts/companion/visual/visual-ir.mjs';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import type { CompilerDiagnostic, OutputKind, TemplateSnapshot } from '../domain/contracts.ts';
import { contractCall } from './frontend.ts';

/** Resolve target dependencies and implementation obligations before rendering any artifact. */
export function lowerTarget(model: Model, template: TemplateSnapshot, kind: OutputKind, sourceName: string): CompilerDiagnostic[] {
  return contractCall('lower', sourceName, () => {
    const pkg = JSON.parse(template.text('package.json')) as { dependencies?: Record<string,string>; devDependencies?: Record<string,string> };
    visualPackages(model, { ...pkg.devDependencies, ...pkg.dependencies });
    if (kind === 'clickdummy' && !template.skillFiles.some(file => file.path === '.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs')) {
      throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'lower', 'Click-dummy output requires the trusted bundled offline builder.'));
    }
    const output: CompilerDiagnostic[] = [];
    for (const [index, component] of visualDefinitions(model).components.entries()) {
      for (const node of visualNodes(component.template)) {
        if (node.kind !== 'external') continue;
        output.push(diagnostic('COMPILER_ADAPTER_REQUIRED','lower',`${component.exportName}: external adapter ${node.adapter} remains an implementation point.`,
          {file:sourceName,jsonPointer:`/design/visualDesigns/components/${index}`,entityId:component.id,document:'normalized'}));
      }
    }
    return output;
  });
}
