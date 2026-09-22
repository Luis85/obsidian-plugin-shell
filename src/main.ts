import { Plugin } from 'obsidian';
import { initializePlugin } from './bootstrap/plugin-runtime';
import './styles/app.css';
/** Composition only: host lifecycle delegates to the runtime. */
export default class ShellPlugin extends Plugin {
  private runtime?: Awaited<ReturnType<typeof initializePlugin>>;
  async onload(): Promise<void> { this.runtime = await initializePlugin(this); }
  onunload(): void { this.runtime?.dispose(); }
}
