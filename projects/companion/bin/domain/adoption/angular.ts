import type { AngularFacts, AngularProject } from './contracts.ts';
import type { PackageFacts } from './manifest.ts';
import { bootstrapStyle, countAngularSource, isZoneless, readRouting } from './angular-source.ts';
import { recordField, textField, type InventoryView, type JsonRecord } from './source.ts';
import { majorOf, versionOf } from './version.ts';

const libraryNames: Record<string, string> = {
  '@angular/material': 'Angular Material', '@angular/cdk': 'Angular CDK', primeng: 'PrimeNG', '@ng-bootstrap/ng-bootstrap': 'ng-bootstrap',
  'ng-zorro-antd': 'NG-ZORRO', '@taiga-ui/core': 'Taiga UI', '@angular/service-worker': 'Angular service worker', '@angular/fire': 'AngularFire',
  '@angular/elements': 'Angular Elements', '@angular/pwa': 'Angular PWA schematics',
};
const stateNames: Record<string, string> = {
  '@ngrx/store': 'NgRx Store', '@ngrx/signals': 'NgRx Signals Store', '@ngrx/component-store': 'NgRx ComponentStore', '@ngxs/store': 'NGXS',
  '@datorama/akita': 'Akita', '@rx-angular/state': 'RxAngular state', '@tanstack/angular-query-experimental': 'TanStack Query',
};
const i18nPackages = ['@angular/localize', '@ngx-translate/core', '@jsverse/transloco', '@ngneat/transloco'];
const ssrPackages = ['@angular/ssr', '@nguniversal/express-engine', '@angular/platform-server'];
const angularBuilder = /^(?:@angular|@angular-devkit|@angular-builders|@nx\/angular|@nrwl\/angular)/;

/** Build-tool class of one builder or executor identifier: application (esbuild), esbuild, webpack, library or other. */
export function builderClass(builder: string | null): string {
  if (builder === null) return 'none';
  if (/ng-packagr|:package$/.test(builder)) return 'library';
  if (builder.endsWith(':application')) return 'application';
  if (builder.endsWith(':browser-esbuild')) return 'esbuild';
  if (/:(?:browser|webpack-browser|dev-server)$/.test(builder)) return 'webpack';
  return 'other';
}
const targetsOf = (project: unknown): JsonRecord => {
  const modern = recordField(project, 'targets');
  return Object.keys(modern).length ? modern : recordField(project, 'architect');
};
const builderOf = (target: unknown): string | null => textField(target, 'builder') ?? textField(target, 'executor');
function workspaceProject(name: string, project: unknown, prefix: string): AngularProject {
  const build = recordField(targetsOf(project), 'build');
  const builder = builderOf(build);
  return { name, type: textField(project, 'projectType') ?? 'unknown', builder, builderClass: builderClass(builder), root: prefix + (textField(project, 'root') ?? '') };
}
const directoryOf = (path: string): string => path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
function angularJsonProjects(view: InventoryView, path: string): AngularProject[] {
  const projects = recordField(view.json(path), 'projects');
  return Object.entries(projects).map(([name, project]) => workspaceProject(name, project, directoryOf(path)));
}
function nxProjects(view: InventoryView): { projects: AngularProject[]; first: string | null } {
  const found: AngularProject[] = [];
  let first: string | null = null;
  for (const path of view.find(/(^|\/)project\.json$/).slice(0, 200)) {
    const json = view.json(path);
    const builders = Object.values(targetsOf(json)).map(builderOf);
    if (!builders.some(item => item !== null && angularBuilder.test(item))) continue;
    first ??= path;
    found.push(workspaceProject(textField(json, 'name') || path.replace(/\/?project\.json$/, '') || 'root', json, directoryOf(path)));
  }
  return { projects: found, first };
}
function allBuilders(view: InventoryView, files: string[]): string[] {
  const builders = new Set<string>();
  for (const path of files) {
    for (const project of Object.values(recordField(view.json(path), 'projects'))) {
      for (const target of Object.values(targetsOf(project))) {
        const builder = builderOf(target);
        if (builder !== null) builders.add(builder);
      }
    }
  }
  return [...builders].sort();
}
const named = (table: Record<string, string>, packages: PackageFacts): string[] => Object.entries(table).filter(([name]) => packages.dependencies.has(name)).map(([, label]) => label).sort();
function i18nFacts(view: InventoryView, packages: PackageFacts, files: string[]): string[] {
  const found = i18nPackages.filter(name => packages.dependencies.has(name));
  if (view.count(/\.xlf$/) > 0) found.push('xlf catalogs');
  if (files.some(path => /"i18n"\s*:/.test(view.text(path) ?? ''))) found.push('angular.json i18n');
  return found;
}
interface Workspace { files: string[]; projects: AngularProject[]; first: string | null }
/** angular.json files win; otherwise Nx project.json files that use an Angular builder. */
function workspaceOf(view: InventoryView): Workspace {
  const files = view.find(/(^|\/)angular\.json$/).slice(0, 5);
  if (files.length) return { files, projects: files.flatMap(path => angularJsonProjects(view, path)), first: files[0]! };
  return { files, ...nxProjects(view) };
}
const hasSsr = (view: InventoryView, packages: PackageFacts): boolean => ssrPackages.some(name => packages.dependencies.has(name)) || view.has('server.ts') || view.has('src/main.server.ts');
function describe(view: InventoryView, packages: PackageFacts, space: Workspace, range: string | null): AngularFacts {
  const major = majorOf(range);
  return {
    version: versionOf(range) ?? range, major, workspace: space.first ?? 'dependency-only', projects: space.projects, builders: allBuilders(view, space.files),
    sourceCounts: countAngularSource(view, major), routing: readRouting(view),
    libraries: named(libraryNames, packages), stateManagement: named(stateNames, packages), ssr: hasSsr(view, packages),
    i18n: i18nFacts(view, packages, space.files), zoneless: isZoneless(view), bootstrap: bootstrapStyle(view),
  };
}
/** Angular facts, or null when neither a dependency nor a workspace configuration names Angular. */
export function readAngular(view: InventoryView, packages: PackageFacts): AngularFacts | null {
  const range = packages.dependencies.get('@angular/core')?.range ?? null;
  const space = workspaceOf(view);
  return range === null && !space.projects.length ? null : describe(view, packages, space, range);
}
