import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exists } from './framework/files.ts';
import { verifyKit } from './framework/kit-integrity.ts';
export async function sourceCheckout(root: string): Promise<boolean> {
  // Bundling rebases this URL into bin/template. A built app must never borrow a
  // neighboring development checkout's templates or package identity.
  const moduleRoot = fileURLToPath(new URL('../../../', import.meta.url));
  return resolve(root) === resolve(moduleRoot) && await exists(join(root, 'src/cli/app.ts'))
    && !await exists(join(root, '.companion/generation.json'));
}
/** The one kit rule for every template consumer: an installed kit (bin/kit.json) is verified and supplies
 * its packaged template under bin/template; a source checkout is its own template. */
export async function resolveTemplateRoot(frameworkRoot: string): Promise<string> {
  if (await sourceCheckout(frameworkRoot) || !await exists(join(frameworkRoot, 'bin/kit.json'))) return frameworkRoot;
  await verifyKit(frameworkRoot);
  return join(frameworkRoot, 'bin/template');
}
