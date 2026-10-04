import { join } from 'node:path';
import { exists } from './framework/files.ts';
import { verifyKit } from './framework/kit-integrity.ts';
/** The one kit rule for every template consumer: an installed kit (bin/kit.json) is verified and supplies
 * its packaged template under bin/template; a source checkout is its own template. */
export async function resolveTemplateRoot(frameworkRoot: string): Promise<string> {
  if (!await exists(join(frameworkRoot, 'bin/kit.json'))) return frameworkRoot;
  await verifyKit(frameworkRoot);
  return join(frameworkRoot, 'bin/template');
}
