import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expandMatrix, type GalleryJob, type MatrixOptions, type Surface } from './gallery-matrix.ts';
import { buildEntry, buildIndex, renderGalleryHtml, type GalleryEntry, type GalleryFailure, type GalleryIndex } from './gallery-report.ts';

/** A browser (or fake) that can list surfaces and render one job to PNG bytes. */
export interface CaptureSession {
  surfaces(): Promise<Surface[]>;
  capture(job: GalleryJob): Promise<Uint8Array>;
  close(): Promise<void>;
}
export interface GalleryRun extends MatrixOptions {
  target: string; outDirectory: string; session: CaptureSession; commit: string | null; clock: () => Date;
}
export interface GalleryResult { index: GalleryIndex; indexFile: string; galleryFile: string }

const generated = (name: string) => name.endsWith('.png') || name === 'index.json' || name === 'gallery.html';
/** Removes only files this tool writes, so a stale capture can never pass for current evidence. */
async function clearGenerated(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  for (const name of await readdir(directory)) if (generated(name)) await rm(join(directory, name));
}
async function captureAll(run: GalleryRun, jobs: readonly GalleryJob[]): Promise<{ entries: GalleryEntry[]; failures: GalleryFailure[] }> {
  const entries: GalleryEntry[] = [], failures: GalleryFailure[] = [];
  for (const job of jobs) {
    try {
      const png = await run.session.capture(job);
      await writeFile(join(run.outDirectory, job.file), png);
      entries.push(buildEntry(job, png, run.commit, run.clock().toISOString()));
    } catch (error) {
      failures.push({ file: job.file, message: error instanceof Error ? error.message.slice(0, 500) : 'Capture failed.' });
    }
  }
  return { entries, failures };
}
/** Captures every job, then writes index.json and gallery.html. The session is always closed. */
export async function runGallery(run: GalleryRun): Promise<GalleryResult> {
  try {
    const jobs = expandMatrix(await run.session.surfaces(), run);
    await clearGenerated(run.outDirectory);
    const { entries, failures } = await captureAll(run, jobs);
    const index = buildIndex(run.target, run.commit, run.clock().toISOString(), entries, failures);
    const indexFile = join(run.outDirectory, 'index.json'), galleryFile = join(run.outDirectory, 'gallery.html');
    await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`);
    await writeFile(galleryFile, renderGalleryHtml(index));
    return { index, indexFile, galleryFile };
  } finally {
    await run.session.close();
  }
}
