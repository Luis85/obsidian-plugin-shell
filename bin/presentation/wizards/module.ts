import type { FormHooks } from '../form-runner.ts';
import type { WizardAction } from '../wizard-runner.ts';
/** One guided process contributes the code hooks its JSON definitions name. Names are globally unique. */
export interface WizardModule { actions?: Record<string, WizardAction>; hooks?: Partial<FormHooks> }
