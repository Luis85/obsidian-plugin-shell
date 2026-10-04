export interface ComponentProps {
  "label"?: string;
  "value"?: string;
}
export interface ComponentEvents {
  "change": [payload: string];
  "cancel": [payload: undefined];
}
export interface ComponentSlots {
  "help"?: () => unknown;
}
