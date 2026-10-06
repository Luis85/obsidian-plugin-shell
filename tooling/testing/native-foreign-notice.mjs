import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { nativeScratchDirectory } from './native-isolation.mjs';

export const foreignNoticeCommands = {
  create: 'Create qualification witness notice', update: 'Update qualification witness notice', dismiss: 'Dismiss qualification witness notice',
};
const id = 'qualification-foreign-notice';
const main = `const { Plugin, Notice } = require('obsidian');
exports.default = class QualificationForeignNotice extends Plugin {
  onload() {
    this.witness = undefined; this.active = true;
    this.addCommand({ id: 'create', name: ${JSON.stringify(foreignNoticeCommands.create)}, callback: () => {
      if (this.active && !this.witness) this.witness = new Notice('Independent qualification owner', 0);
    } });
    this.addCommand({ id: 'update', name: ${JSON.stringify(foreignNoticeCommands.update)}, callback: () => {
      if (this.active) this.witness?.setMessage('Independent qualification owner remains usable');
    } });
    this.addCommand({ id: 'dismiss', name: ${JSON.stringify(foreignNoticeCommands.dismiss)}, callback: () => this.dismissWitness() });
  }
  dismissWitness() { this.witness?.hide(); this.witness = undefined; }
  onunload() { this.active = false; this.dismissWitness(); }
};
`;

/** A distinct controlled plugin owner; never inject module imports into a renderer global. */
export async function createNativeForeignNotice(scratch, candidateId, root = process.cwd()) {
  if (candidateId === id) throw new Error('NATIVE_FOREIGN_ID_COLLISION');
  scratch = await nativeScratchDirectory(scratch, root);
  const directory = join(scratch, 'foreign-owner-plugin'); await mkdir(directory);
  const manifest = `${JSON.stringify({ id, name: 'Qualification notice witness', version: '0.0.0', minAppVersion: '1.13.7',
    description: 'Independent notice owner for isolated qualification only.', author: 'Qualification fixture', isDesktopOnly: true }, null, 2)}\n`;
  const assets = [];
  for (const [file, source] of [['main.js', main], ['manifest.json', manifest]]) {
    await writeFile(join(directory, file), source);
    assets.push({ file, bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex') });
  }
  return { directory, id, assets };
}
