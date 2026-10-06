export interface ComponentProps {
  "title"?: string;
  "description"?: string;
}
export interface ComponentEvents {
  "create": [payload: undefined];
}
export interface ComponentSlots {
  "illustration"?: () => unknown;
}
