export interface AirshipOptions { enabled: boolean; agent: 'claude' | 'codex' | 'opencode'; targetPort: number; port: number }
export interface AirshipConfig { target: number; port: number; host: '127.0.0.1'; agent: AirshipOptions['agent']; mode: 'canvas'; safe: true; commit: false; open: false }
export declare const AIRSHIP_VERSION: string;
/** Throws COMPANION_TOOLING_INVALID; undefined means no development tooling was requested. */
export declare function validateTooling(value: unknown): void;
export declare function airshipOptions(tooling: unknown): AirshipOptions;
export declare function airshipConfig(tooling: unknown): AirshipConfig;
export declare function toolingSchema(): Record<string, unknown>;
