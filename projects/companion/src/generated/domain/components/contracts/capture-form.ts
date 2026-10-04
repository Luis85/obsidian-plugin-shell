export interface ComponentProps {
  "title"?: string;
  "busy"?: boolean;
}
export interface ComponentEvents {
  "submit": [payload: string];
  "cancel": [payload: undefined];
}
export interface ComponentSlots {
  "footer"?: () => unknown;
}
