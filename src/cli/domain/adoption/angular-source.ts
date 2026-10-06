import type { AngularSourceCounts } from './contracts.ts';
import type { InventoryView } from './source.ts';

const sourceFile = /\.ts$/;
const excluded = /(?:\.spec|\.test|\.d|\.stories|\.e2e)\.ts$/;
const routeFileName = /(?:^|\/)[^/]*(?:routes?|routing)[^/]*\.ts$/i;
const routeSignal = /\bprovideRouter\s*\(|RouterModule\.for(?:Root|Child)\s*\(|:\s*Routes\s*=|:\s*Route\[\]\s*=/;
const signalCall = /\b(?:signal|computed|effect|linkedSignal|toSignal|toObservable|model|input|output|viewChild|viewChildren|contentChild|contentChildren)(?:\.required)?\s*(?:<[^()]*>)?\s*\(/g;
const routePath = /\bpath\s*:\s*(['"`])([^'"`\n]{0,80})\1/g;

const countMatches = (text: string, pattern: RegExp): number => (text.match(pattern) ?? []).length;
const safeRoute = (value: string): boolean => /^[A-Za-z0-9/_:.*-]*$/.test(value);

function emptyCounts(): AngularSourceCounts {
  return { components: 0, standaloneComponents: 0, ngModules: 0, services: 0, pipes: 0, directives: 0, signalCalls: 0, decoratorInputs: 0, sourceFiles: 0 };
}
/** Application source files that were read; specs, declarations and stories are not counted as product code. */
function applicationSources(view: InventoryView): Array<[string, string]> {
  return view.texts(sourceFile).filter(([path]) => !excluded.test(path));
}
function standaloneEstimate(components: number, explicitTrue: number, explicitFalse: number, major: number | null): number {
  if (major !== null && major >= 19) return Math.max(0, components - explicitFalse);
  return Math.min(components, explicitTrue);
}
export function countAngularSource(view: InventoryView, major: number | null): AngularSourceCounts {
  const counts = emptyCounts();
  let explicitTrue = 0, explicitFalse = 0;
  for (const [, text] of applicationSources(view)) {
    counts.sourceFiles++;
    counts.components += countMatches(text, /@Component\s*\(/g);
    counts.ngModules += countMatches(text, /@NgModule\s*\(/g);
    counts.services += countMatches(text, /@Injectable\s*\(/g);
    counts.pipes += countMatches(text, /@Pipe\s*\(/g);
    counts.directives += countMatches(text, /@Directive\s*\(/g);
    counts.decoratorInputs += countMatches(text, /@Input\s*\(/g);
    explicitTrue += countMatches(text, /standalone\s*:\s*true/g);
    explicitFalse += countMatches(text, /standalone\s*:\s*false/g);
    if (text.includes('@angular/core')) counts.signalCalls += countMatches(text, signalCall);
  }
  counts.standaloneComponents = standaloneEstimate(counts.components, explicitTrue, explicitFalse, major);
  return counts;
}
function addRoute(paths: string[], route: string): void {
  if (route && route !== '**' && !route.startsWith(':') && safeRoute(route) && !paths.includes(route) && paths.length < 60) paths.push(route);
}
export function readRouting(view: InventoryView): { files: string[]; routeCountEstimate: number; paths: string[] } {
  const files: string[] = [], paths: string[] = [];
  let routeCountEstimate = 0;
  for (const [path, text] of applicationSources(view)) {
    if (!routeFileName.test(path) && !routeSignal.test(text)) continue;
    files.push(path);
    for (const match of text.matchAll(routePath)) { routeCountEstimate++; addRoute(paths, match[2]!); }
  }
  return { files: files.slice(0, 40), routeCountEstimate, paths };
}
export function bootstrapStyle(view: InventoryView): string {
  const sources = applicationSources(view);
  const application = sources.some(([, text]) => /bootstrapApplication\s*\(/.test(text));
  const module = sources.some(([, text]) => /bootstrapModule\s*\(/.test(text));
  if (application && module) return 'mixed';
  if (application) return 'bootstrapApplication';
  return module ? 'bootstrapModule' : 'unknown';
}
export const isZoneless = (view: InventoryView): boolean => applicationSources(view).some(([, text]) => /provide(?:Experimental)?ZonelessChangeDetection\s*\(/.test(text));
