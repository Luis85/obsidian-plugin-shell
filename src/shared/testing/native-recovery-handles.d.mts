import type { Page } from '@playwright/test';

export function retainNativeAction(page: Page, label: string, selector?: string): Promise<{
  invoke(): Promise<void>;
  calls(): number;
  dispose(): Promise<void>;
}>;
export function startAndCloseRecovery(element: HTMLElement): void;
