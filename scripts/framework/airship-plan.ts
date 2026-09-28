import { join } from 'node:path';
import { createFilePlan } from '../shared/file-plan.mjs';
import { parseAuthoringDocument, validateAuthoringDocument } from '../companion/authoring-contract.ts';
import { withAirshipOption } from '../companion/tooling-options.ts';
import { airshipConfig, airshipOptions } from '../companion/tooling-contract.mjs';
import { serializeJson as json } from '../contracts/serialization.ts';
import { readBounded, readJson, exists, hash } from './files.ts';
import { object, designFile } from './configuration.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
/** Read-modify-write is bound to current bytes and replayed by the shared plan executor. */
export async function airshipPlan(request: Request, context: Context) {
  const before = await readBounded(join(context.root, designFile), 4_000_000);
  const original = parseAuthoringDocument(before.toString('utf8'));
  const enabled = request.command === 'airship enable';
  const next = withAirshipOption(original, { [enabled ? 'airship' : 'no-airship']: true });
  const settings = airshipOptions(next.tooling);
  for (const [option, field] of [['agent', 'agent'], ['target-port', 'targetPort'], ['port', 'port']] as const) {
    const value = stringOption(request.options, option);
    if (value !== undefined) Object.assign(settings, { [field]: field === 'agent' ? value : Number(value) });
  }
  next.tooling = { ...next.tooling, airship: settings };
  validateAuthoringDocument(next);
  const entries = [{ path: designFile, content: json(next) }];
  if (enabled) {
    const path = 'airship.config.json', content = json(airshipConfig(next.tooling));
    if (await exists(join(context.root, path))) {
      const actual = object(await readJson(join(context.root, path))), expected = airshipConfig(original.tooling);
      requireThat(JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort()),
        'AIRSHIP_CONFIG_CONFLICT', 'Preserve customized Airship configuration; reconcile it with tooling.airship before enabling.');
    }
    entries.push({ path, content });
  }
  const receiptPath = '.companion/generation.json';
  if (await exists(join(context.root, receiptPath))) {
    const receipt = object(await readJson(join(context.root, receiptPath)));
    requireThat(receipt.version === 1 && receipt.projectId === original.project.id && Array.isArray(receipt.files), 'AIRSHIP_OWNERSHIP', 'Invalid generation receipt.');
    const records = receipt.files.map(object);
    const owned = records.filter(record => record.path === designFile);
    requireThat(owned.length === 1 && owned[0]!.hash === hash(before) && owned[0]!.ownership === 'managed',
      'AIRSHIP_OWNERSHIP', 'Reconcile edited project JSON before changing tooling; no ownership receipt was adopted.');
    for (const entry of entries) {
      const record = records.find(record => record.path === entry.path);
      if (record) record.hash = hash(entry.content);
      else records.push({ path: entry.path, hash: hash(entry.content), ownership: 'extension' });
    }
    receipt.files = records;
    entries.push({ path: receiptPath, content: json(receipt) });
  }
  const intakePath = '.framework/intake.json';
  if (await exists(join(context.root, intakePath))) {
    const intake = object(await readJson(join(context.root, intakePath))), files = object(intake.files);
    requireThat(intake.schemaVersion === 1 && files[designFile] === hash(before), 'AIRSHIP_OWNERSHIP', 'Reconcile changed intake before updating tooling.');
    files[designFile] = hash(entries[0]!.content);
    entries.push({ path: intakePath, content: json(intake) });
  }
  return { plan: await createFilePlan(context.root, entries), conflicts: [] as string[],
    summary: { airship: settings, installation: 'not-run', launch: 'not-run', sourceEdits: 'preserved',
      next: enabled ? 'airship install --yes; dev --profile preview; airship start --yes' : 'Stop existing sessions explicitly; installed tooling is retained.' } };
}
