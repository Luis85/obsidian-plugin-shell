/** Ownership receipts that a read-modify-write of design/project.json (airship enable/disable, hosting set) must
 * carry forward: the generation receipt and the intake receipt still have to own the unedited design. */
import { join } from 'node:path';
import { readJson, exists, hash } from './files.ts';
import { object, designFile } from './configuration.ts';
import { requireThat, type Context } from './contracts.ts';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
export type Entry = { path: string; content: string };
/** The generation receipt must still own the unedited design; it then records the new hashes. */
async function generationReceiptEntry(context: Context, projectId: string, before: Buffer, entries: Entry[], code: string): Promise<Entry | null> {
  const receiptPath = '.companion/generation.json';
  if (!await exists(join(context.root, receiptPath))) return null;
  const receipt = object(await readJson(join(context.root, receiptPath)));
  requireThat(receipt.version === 1 && receipt.projectId === projectId && Array.isArray(receipt.files), code, 'Invalid generation receipt.');
  const records = (receipt.files as unknown[]).map(object);
  const owned = records.filter(record => record.path === designFile);
  requireThat(owned.length === 1 && owned[0]!.hash === hash(before) && owned[0]!.ownership === 'managed',
    code, 'Reconcile edited project JSON before changing tooling; no ownership receipt was adopted.');
  for (const entry of entries) {
    const record = records.find(record => record.path === entry.path);
    if (record) record.hash = hash(entry.content);
    else records.push({ path: entry.path, hash: hash(entry.content), ownership: 'extension' });
  }
  receipt.files = records;
  return { path: receiptPath, content: json(receipt) };
}
async function intakeEntry(context: Context, before: Buffer, design: Entry, code: string): Promise<Entry | null> {
  const intakePath = '.framework/intake.json';
  if (!await exists(join(context.root, intakePath))) return null;
  const intake = object(await readJson(join(context.root, intakePath))), files = object(intake.files);
  requireThat(intake.schemaVersion === 1 && files[designFile] === hash(before), code, 'Reconcile changed intake before updating tooling.');
  files[designFile] = hash(design.content);
  return { path: intakePath, content: json(intake) };
}
/** Both receipts, in the order the airship plan has always written them. */
export async function receiptEntries(context: Context, projectId: string, before: Buffer, entries: Entry[], code: string): Promise<Entry[]> {
  const receipt = await generationReceiptEntry(context, projectId, before, entries, code);
  const intake = await intakeEntry(context, before, entries[0]!, code);
  return [...(receipt ? [receipt] : []), ...(intake ? [intake] : [])];
}
