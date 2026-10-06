/** Locations the adoption plan proposes. Plain data shared by collision findings and plan rendering. */
export const kitDirectory = 'tools/shell-cli';
export const planPath = 'docs/workbench/ADOPTION-PLAN.md';
export const reportPath = 'docs/workbench/adoption-report.json';
export const designDirectory = 'design';
export const designFile = 'design/project.json';
export const documentationDirectory = 'docs/workbench';
export const generatedAppDirectory = 'apps/workbench-app';
export const skillName = 'adopt-existing-project';
export const skillRoots: readonly string[] = ['.claude/skills', '.agents/skills'];
/** Paths the integration may add; each is checked for an existing occupant. */
export const addedPaths: readonly string[] = [kitDirectory, designDirectory, documentationDirectory, generatedAppDirectory, ...skillRoots.map(root => `${root}/${skillName}`)];
/** The kit is always invoked through this prefix once extracted under the project. */
export const kitCommand = `node ${kitDirectory}/bin/app`;
const adoptionOutputs: ReadonlySet<string> = new Set([planPath, reportPath, `${documentationDirectory}/screens.request.json`, `${documentationDirectory}/app.request.json`]);
/** Files the adoption workflow itself writes; scans ignore them so re-running a command is idempotent. */
export const isAdoptionOutput = (path: string): boolean => adoptionOutputs.has(path);
