/** Neither option implies the other. Missing fields are false. */
export interface StorybookOptions { enabled?: boolean; generateStories?: boolean }
export function validateStorybookOptions(value?: unknown): Required<StorybookOptions>;
