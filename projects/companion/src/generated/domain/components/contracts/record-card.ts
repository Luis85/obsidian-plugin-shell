export interface ComponentProps {
  "title"?: string;
  "selected"?: boolean;
}
export interface ComponentEvents {
  "select": [payload: string];
}
export interface ComponentSlots {
  "actions"?: () => unknown;
}
