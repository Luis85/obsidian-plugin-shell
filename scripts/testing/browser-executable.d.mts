export declare const BROWSER_ENV: 'SHELL_CHROMIUM';
export interface BrowserFileSystem { exists(path: string): boolean; readText(path: string): string; list(path: string): string[] }
export interface BrowserResolveOptions {
  env?: Readonly<Record<string, string | undefined>>; root?: string; platform?: string; home?: string; cwd?: string; fs?: BrowserFileSystem;
}
export interface BrowserResolution {
  status: 'pinned' | 'override' | 'revision-mismatch' | 'missing'; executablePath?: string; expectedRevision?: string; availableRevisions?: string[];
  reason?: string; candidateExecutable?: string; overridePath?: string; playwrightVersion?: string; hint: string;
}
export declare function browsersDirectory(options: { env: Readonly<Record<string, string | undefined>>; root: string; platform: string; home: string; cwd: string }): string;
export declare function resolveBrowserExecutable(options?: BrowserResolveOptions): BrowserResolution;
export declare function chromiumLaunchOptions(options?: BrowserResolveOptions): { executablePath?: string };
export declare function main(argv: string[], options?: BrowserResolveOptions): number;
