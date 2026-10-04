import { stagedBuild } from './staged-build.mjs';
const candidate = await stagedBuild();
console.log(`Built complete ${candidate.version} candidate: ${candidate.directory}`);
