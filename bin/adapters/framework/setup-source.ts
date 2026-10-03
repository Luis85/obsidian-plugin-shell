import { companionStarterSet } from './starter-project.ts';
import { customizeStarter } from '../starters/customize.ts';
import { serializeJson } from '../../../scripts/contracts/serialization.ts';
import { requireThat, stringOption, type Request, type Context } from './contracts.ts';
import type { Configuration } from './configuration.ts';

/** Reuse the verified catalog and ordinary import transaction, never `new` into an occupied kit. */
export async function setupSource(request: Request, context: Context, config: Configuration | null) {
  const options = request.options, starter = stringOption(options, 'starter'), input = stringOption(options, 'input');
  requireThat([Boolean(input), options.blank === true, Boolean(starter)].filter(Boolean).length <= 1,
    'SETUP_START_CONFLICT', 'Choose exactly one of --starter, --input or --blank.');
  if (!starter) {
    requireThat(options.extension === undefined && options.extensions === undefined, 'NATIVE_OPTIONS_REQUIRE_STARTER', 'Use native options with --starter.');
    return { input, context, origin: null };
  }
  const { starters } = await companionStarterSet(context);
  const entry = starters.find(value => value.definition.id === starter);
  requireThat(entry, 'STARTER_UNKNOWN', 'Unknown starter; use new --list to see the verified catalog.');
  requireThat(config, 'IDENTITY_REQUIRED', 'Supply --id, --name and --author for starter setup.');
  const document = customizeStarter(entry, {
    ...config.project, codebaseFolder: config.paths.codebaseFolder, testsFolder: config.paths.testsFolder,
    ...(options.extension === undefined ? {} : { extension: stringOption(options, 'extension') }),
    ...(options.extensions === undefined ? {} : { extensions: stringOption(options, 'extensions') }),
  });
  const text = serializeJson(document);
  return { input: '-', context: { ...context, inputText: text }, origin: { id: entry.definition.id, version: entry.definition.version, sha256: entry.sha256 } };
}
