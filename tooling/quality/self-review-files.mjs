/** File-level self-review rules that need the working tree: suite classification and code-line limits. */
import { checkSuites } from '../../src/cli/tooling/testing/suite-manifest.mjs';
import { sourceInputs } from '../testing/source-inputs.mjs';

/** Where the repository's own check:source gate measures code lines; limits elsewhere are not enforced. */
const limitScope = [/^(?:src|harness|scripts|tests|configs|bin|templates|plugins)\//, /^\.github\/workflows\//, /^(?:package|tsconfig)\.json$/,
  /^\.claude\/skills\/companion-prototype-design\//];
const classificationFailure = /^(UNCLASSIFIED_TEST_FILE|AMBIGUOUS_TEST_FILE): (\S+) (.*)$/;
const present = file => file.status !== 'D';

/** New or moved test files must belong to exactly one suite (or helper) in tests/suites.json. */
export async function unclassifiedTests(root, files) {
  const added = new Map(files.filter(file => file.status === 'A' || file.status === 'R').map(file => [file.path, file]));
  if (!added.size) return [];
  let result;
  try { result = await checkSuites(root); }
  catch (error) { return [{ rule: 'SR-UNCLASSIFIED-TEST', file: 'tests/suites.json', line: 1, message: `suite manifest could not be evaluated: ${error.message.split('\n')[0]}` }]; }
  const found = [];
  for (const failure of result.failures) {
    const match = classificationFailure.exec(failure);
    if (!match || !added.has(match[2])) continue;
    found.push({ rule: 'SR-UNCLASSIFIED-TEST', file: match[2], line: 1,
      message: `${match[1] === 'AMBIGUOUS_TEST_FILE' ? 'claimed by more than one suite' : 'not classified in tests/suites.json'}; add it to exactly one suite (node scripts/testing/suites.mjs --check)` });
  }
  return found;
}

/** Changed handwritten files must stay within the reviewed code-line limits (comments and blanks excluded). */
export async function overLimitFiles(root, files) {
  const paths = files.filter(file => present(file) && limitScope.some(pattern => pattern.test(file.path))).map(file => file.path);
  const found = [];
  for (const path of paths) {
    let measured;
    try { measured = (await sourceInputs(root, [path])).files[0]; }
    catch (error) { found.push({ rule: 'SR-LINE-LIMIT', file: path, line: 1, message: `cannot measure code lines: ${error.message}` }); continue; }
    if (measured && measured.limit !== null && measured.lines > measured.limit)
      found.push({ rule: 'SR-LINE-LIMIT', file: path, line: 1, message: `${measured.lines} code lines exceed the ${measured.limit}-line limit; split the module by responsibility` });
  }
  return found;
}
