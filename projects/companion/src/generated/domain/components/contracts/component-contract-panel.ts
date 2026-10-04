export interface ComponentProps {
  "title"?: string;
  "busy"?: boolean;
}
export interface ComponentEvents {
  "select": [payload: string];
  "cancel": [payload: undefined];
}
export interface ComponentSlots {
  "content"?: () => unknown;
}
