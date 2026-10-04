export interface ComponentProps {
  "message"?: string;
  "busy"?: boolean;
}
export interface ComponentEvents {
  "retry": [payload: undefined];
}
export interface ComponentSlots {
  "details"?: () => unknown;
}
