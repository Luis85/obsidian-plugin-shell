import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function args(argv, values = [], flags = []) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--') || (!values.includes(key) && !flags.includes(key))) {
      throw new Error(`Unknown argument: ${key}`);
    }
    if (Object.hasOwn(result, key.slice(2))) throw new Error(`Duplicate argument: ${key}`);
    if (flags.includes(key)) result[key.slice(2)] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${key}`);
      result[key.slice(2)] = value;
    }
  }
  return result;
}
export function need(options, key) {
  if (!options[key]) throw new Error(`Required --${key}`);
  return options[key];
}
/** First existing candidate under root (the shell repository layout first, then an extracted kit or generated project); the last candidate when none exists. */
export function layoutPath(root, ...candidates) {
  return candidates.find(candidate => fs.existsSync(path.join(root, candidate))) ?? candidates[candidates.length - 1];
}
export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
export function noLinks(value) {
  const full = path.resolve(value);
  const { root } = path.parse(full);
  let current = root;
  for (const part of full.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink refused: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      break;
    }
  }
  return full;
}
export function readBytes(file, limit = 30_000_000) {
  const full = noLinks(file);
  const stat = fs.statSync(full);
  if (!stat.isFile() || stat.size > limit) throw new Error(`Not a bounded regular file: ${full}`);
  const fd = fs.openSync(full, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size > limit) {
      throw new Error(`File changed before read: ${full}`);
    }
    const buffer = Buffer.alloc(opened.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const n = fs.readSync(fd, buffer, offset, buffer.length - offset, null);
      if (n === 0) break;
      offset += n;
    }
    const after = fs.fstatSync(fd);
    if (offset !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) {
      throw new Error(`File changed during read: ${full}`);
    }
    return buffer.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}
export function readText(file, limit) { return new TextDecoder('utf-8', { fatal: true }).decode(readBytes(file, limit)); }
export function readJson(file, limit) { return JSON.parse(readText(file, limit)); }
function writeFresh(file, text) {
  const full = noLinks(file);
  if (!fs.statSync(path.dirname(full)).isDirectory()) throw new Error('Output parent must exist');
  fs.writeFileSync(full, text, { flag: 'wx', mode: 0o600 });
}
export function writeBuild(file, text, replace = false) {
  const full = noLinks(file);
  if (!replace) return writeFresh(full, text);
  if (fs.existsSync(full) && !fs.lstatSync(full).isFile()) throw new Error('Build output is not a regular file');
  const temp = path.join(path.dirname(full), `.${path.basename(full)}.${crypto.randomUUID()}.tmp`);
  writeFresh(temp, text);
  try { fs.renameSync(temp, full); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(path.resolve(process.argv[1])).href;
}
export function cli(fn) {
  Promise.resolve().then(fn).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
