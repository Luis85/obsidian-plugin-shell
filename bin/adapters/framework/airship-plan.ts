import { join } from 'node:path';
import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { parseAuthoringDocument, validateAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { withAirshipOption } from '../../../scripts/companion/tooling-options.ts';
import { airshipConfig, airshipOptions } from '../../../scripts/companion/tooling-contract.mjs';
import { serializeJson as json } from '../../../scripts/contracts/serialization.ts';
import { readBounded, readJson, exists } from './files.ts';
import { object, designFile } from './configuration.ts';
import { receiptEntries, type Entry } from './design-receipts.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
type Document = ReturnType<typeof parseAuthoringDocument>;
function airshipSettings(request: Request, next: Document) {
  const settings = airshipOptions(next.tooling);
  for (const [option, field] of [['agent', 'agent'], ['target-port', 'targetPort'], ['port', 'port']] as const) {
    const value = stringOption(request.options, option);
    if (value !== undefined) Object.assign(settings, { [field]: field === 'agent' ? value : Number(value) });
  }
  return settings;
}
/** Enabling writes airship.config.json, refusing to replace a customized one. */
async function configEntry(context: Context, original: Document, next: Document): Promise<Entry> {
  const path = 'airship.config.json', content = json(airshipConfig(next.tooling));
  if (await exists(join(context.root, path))) {
    const actual = object(await readJson(join(context.root, path))), expected = airshipConfig(original.tooling);
    requireThat(JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort()),
      'AIRSHIP_CONFIG_CONFLICT', 'Preserve customized Airship configuration; reconcile it with tooling.airship before enabling.');
  }
  return { path, content };
}
/** Read-modify-write is bound to current bytes and replayed by the shared plan executor. */
export async function airshipPlan(request: Request, context: Context) {
  const before = await readBounded(join(context.root, designFile), 4_000_000);
  const original = parseAuthoringDocument(before.toString('utf8'));
  const enabled = request.command === 'airship enable';
  const next = withAirshipOption(original, { [enabled ? 'airship' : 'no-airship']: true });
  const settings = airshipSettings(request, next);
  next.tooling = { ...next.tooling, airship: settings };
  validateAuthoringDocument(next);
  const design = { path: designFile, content: json(next) };
  const entries: Entry[] = [design];
  if (enabled) entries.push(await configEntry(context, original, next));
  entries.push(...await receiptEntries(context, original.project.id, before, entries, 'AIRSHIP_OWNERSHIP'));
  return { plan: await createFilePlan(context.root, entries), conflicts: [] as string[],
    summary: { airship: settings, installation: 'not-run', launch: 'not-run', sourceEdits: 'preserved',
      next: enabled ? 'airship install --yes; dev --profile preview; airship start --yes' : 'Stop existing sessions explicitly; installed tooling is retained.' } };
}
