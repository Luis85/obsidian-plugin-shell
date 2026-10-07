/**
 * Terminal interview of `increment new` and `pr new`: asks only for answers the flags did not give and turns them
 * into the same options a headless caller passes, so both paths plan identical files. TTY only; never with --json,
 * --yes or --no-interaction (framework-cli decides).
 */
import { parseConfirmation } from '../../../../scripts/shared/confirmation.ts';
import { requireThat, type Request } from '../../adapters/framework/contracts.ts';

type Prompt = (query: string) => Promise<string>;
type Options = Request['options'];

async function askText(options: Options, key: string, prompt: Prompt, question: string, required = false): Promise<void> {
  if (typeof options[key] === 'string') return;
  const answer = (await prompt(question)).trim();
  requireThat(answer || !required, 'INCREMENT_INPUT_INVALID', `Supply the ${key}.`);
  if (answer) options[key] = answer;
}
async function askChoice(options: Options, key: string, prompt: Prompt, question: string, values: readonly string[]): Promise<void> {
  if (typeof options[key] === 'string') return;
  const answer = (await prompt(question)).trim();
  requireThat(!answer || values.includes(answer), 'INCREMENT_INPUT_INVALID', `Choose one of ${values.join(', ')}.`);
  if (answer) options[key] = answer;
}
/** A yes/no question for a --flag/--no-flag pair; an empty answer keeps the default (yes). */
async function askFlag(options: Options, key: string, prompt: Prompt, question: string): Promise<void> {
  if (options[key] === true || options[`no-${key}`] === true) return;
  if (parseConfirmation((await prompt(`${question} [Y/n] `)).trim() || 'y') === false) options[`no-${key}`] = true;
}
/** The guided request; any other command is returned unchanged. */
export async function guidedIncrement(request: Request, prompt: Prompt): Promise<Request> {
  if (request.options['dry-run']) return request;
  if (request.command === 'increment commit') return guidedCommit(request, prompt);
  if (!['increment new', 'increment plan', 'pr new'].includes(request.command)) return request;
  const options: Options = { ...request.options };
  const subject = request.command.startsWith('increment ') ? `increment ${request.args[0] ?? ''}`.trim() : `pull request of ${request.args[0] ?? 'the increment'}`;
  if (options.input === undefined) await askText(options, 'title', prompt, `Title of the ${subject}: `, true);
  if (request.command.startsWith('increment ')) {
    await askText(options, 'owner', prompt, 'Owner (name or handle, empty to fill in later): ');
    await askChoice(options, 'size', prompt, 'Size S, M or L [M]: ', ['S', 'M', 'L']);
    await askChoice(options, 'e2e', prompt, 'End-to-end tests none, optional or required [optional]: ', ['none', 'optional', 'required']);
    await askFlag(options, 'issue', prompt, 'Create the corresponding issue?');
  }
  if (request.command !== 'increment plan') await askFlag(options, 'branch', prompt, 'Create the branch when git is available and it does not exist yet?');
  return { ...request, options };
}

async function guidedCommit(request: Request, prompt: Prompt): Promise<Request> {
  if (request.options.branch || request.options['no-branch']) return request;
  const create = parseConfirmation(await prompt('Create the iteration branch and commit its planning records? [y/N] ')) === true;
  return { ...request, options: { ...request.options, [create ? 'branch' : 'no-branch']: true } };
}
