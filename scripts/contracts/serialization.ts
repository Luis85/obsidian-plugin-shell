/** Stable pretty-printed JSON for framework-owned validated data. */
export const serializeJson = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';
