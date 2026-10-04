export interface ComponentProps {
  "query"?: string;
  "count"?: number;
}
export interface ComponentEvents {
  "search": [payload: string];
  "clear": [payload: undefined];
}
export interface ComponentSlots {
  "actions"?: () => unknown;
}
