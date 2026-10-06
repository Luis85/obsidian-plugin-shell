import { OperationError, type Context, type Request, type Result } from './contracts.ts';
import { uiGallery } from './ui-gallery.ts';
import { uiStatus } from './ui-status.ts';

type UiHandler = (request: Request, context: Context) => Promise<Result> | Result;
/** One handler per `ui <subcommand>`; add a subcommand by adding an entry here and a catalog row. */
const handlers: Record<string, UiHandler> = {
  'ui gallery': uiGallery,
  'ui status': uiStatus,
};
export const isUiCommand = (request: Request): boolean => request.command.startsWith('ui ');
export async function uiOperation(request: Request, context: Context): Promise<Result> {
  const handler = Object.hasOwn(handlers, request.command) ? handlers[request.command] : undefined;
  if (!handler) throw new OperationError('UNKNOWN_COMMAND', `Unknown ui command: ${request.command}.`, 'node bin/app help');
  return handler(request, context);
}
