import type { ToolingFacts, UiFacts } from './contracts.ts';
import type { PackageFacts } from './manifest.ts';
import type { InventoryView } from './source.ts';

type Probe = [id: string, packages: readonly string[], files: RegExp | null];
const has = (packages: PackageFacts, names: readonly string[]): boolean => names.some(name => packages.dependencies.has(name));
function probe(view: InventoryView, packages: PackageFacts, probes: readonly Probe[]): string[] {
  return probes.filter(([, names, files]) => has(packages, names) || (files !== null && view.count(files) > 0)).map(([id]) => id).sort();
}
const stylingProbes: readonly Probe[] = [
  ['scss', ['sass', 'sass-embedded', 'node-sass'], /\.scss$/], ['less', ['less'], /\.less$/], ['tailwind', ['tailwindcss', '@tailwindcss/postcss', '@tailwindcss/vite'], /(^|\/)tailwind\.config\.[cm]?[jt]s$/],
  ['bootstrap', ['bootstrap', '@ng-bootstrap/ng-bootstrap'], null], ['angular-material-theme', ['@angular/material'], null],
  ['css-in-js', ['styled-components', '@emotion/react', '@emotion/styled'], null], ['postcss', ['postcss'], /(^|\/)postcss\.config\.[cm]?[jt]s$/],
  ['storybook', ['storybook', '@storybook/angular'], /(^|\/)\.storybook\//],
];
const tokenFile = /(?:^|\/)(?:_?design-?tokens?|tokens)(?:[.-][A-Za-z0-9.-]*)?\.(?:json|scss|css|ts)$|(?:^|\/)style-dictionary[^/]*$/i;
const themeFile = /(?:^|\/)_?(?:[A-Za-z0-9-]*theme[A-Za-z0-9-]*|variables|_variables)\.(?:scss|css|less)$/i;
export function readUi(view: InventoryView, packages: PackageFacts): UiFacts {
  return {
    styling: probe(view, packages, stylingProbes),
    tokenFiles: view.find(tokenFile).slice(0, 20),
    themeFiles: view.find(themeFile).slice(0, 20),
    styleFiles: view.count(/\.(?:s?css|less|sass)$/),
  };
}
const testingProbes: readonly Probe[] = [
  ['karma', ['karma', 'karma-jasmine'], /(^|\/)karma\.conf\.[cm]?js$/], ['jasmine', ['jasmine-core', '@types/jasmine'], null],
  ['jest', ['jest', 'jest-preset-angular', '@angular-builders/jest', '@nx/jest'], /(^|\/)jest\.config\.[cm]?[jt]s$/], ['vitest', ['vitest'], /(^|\/)vitest\.config\.[cm]?[jt]s$/],
  ['cypress', ['cypress'], /(^|\/)cypress\.config\.[cm]?[jt]s$/], ['playwright', ['@playwright/test', 'playwright'], /(^|\/)playwright\.config\.[cm]?[jt]s$/],
  ['testing-library', ['@testing-library/angular', '@testing-library/react', '@testing-library/vue'], null], ['protractor', ['protractor'], null],
];
const lintProbes: readonly Probe[] = [
  ['eslint', ['eslint'], /(^|\/)(?:eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.[a-z]+)?)$/], ['angular-eslint', ['angular-eslint', '@angular-eslint/eslint-plugin'], null],
  ['stylelint', ['stylelint'], /(^|\/)\.stylelintrc(?:\.[a-z]+)?$/], ['tslint', ['tslint'], /(^|\/)tslint\.json$/], ['oxlint', ['oxlint'], null], ['biome', ['@biomejs/biome'], /(^|\/)biome\.jsonc?$/],
  ['husky', ['husky'], /(^|\/)\.husky\//], ['lint-staged', ['lint-staged'], null], ['commitlint', ['@commitlint/cli'], null],
];
const formatProbes: readonly Probe[] = [
  ['prettier', ['prettier'], /(^|\/)(?:\.prettierrc(?:\.[a-z]+)?|prettier\.config\.[cm]?[jt]s)$/], ['editorconfig', [], /(^|\/)\.editorconfig$/], ['biome', ['@biomejs/biome'], /(^|\/)biome\.jsonc?$/],
];
const ciFiles: ReadonlyArray<[string, RegExp]> = [
  ['github-actions', /^\.github\/workflows\/[^/]+\.ya?ml$/], ['gitlab-ci', /^\.gitlab-ci\.ya?ml$/], ['azure-pipelines', /(^|\/)azure-pipelines[^/]*\.ya?ml$/],
  ['circleci', /^\.circleci\/config\.ya?ml$/], ['bitbucket-pipelines', /^bitbucket-pipelines\.ya?ml$/], ['jenkins', /(^|\/)Jenkinsfile$/], ['travis', /^\.travis\.ya?ml$/], ['drone', /^\.drone\.ya?ml$/],
];
const monorepoProbes: readonly Probe[] = [
  ['nx', ['nx', '@nx/workspace'], /^nx\.json$/], ['turborepo', ['turbo'], /^turbo\.json$/], ['lerna', ['lerna'], /^lerna\.json$/], ['rush', [], /^rush\.json$/], ['pnpm-workspaces', [], /^pnpm-workspace\.ya?ml$/],
];
export function readTooling(view: InventoryView, packages: PackageFacts): ToolingFacts {
  const monorepo = probe(view, packages, monorepoProbes);
  if (packages.workspaces.length) monorepo.push('package-workspaces');
  return {
    testing: probe(view, packages, testingProbes),
    specFiles: view.count(/\.(?:spec|test)\.[cm]?[jt]sx?$/),
    lint: probe(view, packages, lintProbes),
    format: probe(view, packages, formatProbes),
    ciProviders: ciFiles.filter(([, pattern]) => view.count(pattern) > 0).map(([id]) => id).sort(),
    workflows: view.find(/^\.github\/workflows\/[^/]+\.ya?ml$/).slice(0, 30),
    monorepo: monorepo.sort(),
    workspaces: packages.workspaces.slice(0, 20),
  };
}
