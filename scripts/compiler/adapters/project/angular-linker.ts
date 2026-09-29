/** Resolve partial-Ivy dependencies at build time, never by loading a JIT compiler in the host.
 * Babel 7.29.0 matches the resolved Angular 22 consumer lock used by preset qualification.
 * Contract: https://angular.dev/tools/libraries/creating-libraries#consuming-partial-ivy-code-outside-the-angular-cli
 */
export const angularBabelVersion = '7.29.0';
export const angularLinkerSource = `import { transformAsync } from '@babel/core';
import linker from '@angular/compiler-cli/linker/babel';
export function angularLinker() {
  return { name: 'project-angular-linker', enforce: 'pre',
    async transform(code, id) {
      const filename = id.split('?')[0];
      if (!/\\.[cm]?js$/.test(filename) || !code.includes('ɵɵngDeclare')) return null;
      const result = await transformAsync(code, { filename, configFile: false, babelrc: false,
        sourceMaps: true, compact: false, plugins: [linker] });
      if (!result || typeof result.code !== 'string') throw new Error('ANGULAR_LINKER_OUTPUT');
      return { code: result.code, map: result.map ?? null };
    },
  };
}
`;
