import { Plugin } from 'obsidian';
import { initializeProject } from "./generated/bootstrap/install.ts";
import './styles/app.css';
import "./generated/styles/project.css";
export default class GeneratedPlugin extends Plugin {
  private runtime?: Awaited<ReturnType<typeof initializeProject>>;
  async onload(): Promise<void> { this.runtime = await initializeProject(this); }
  onunload(): void { this.runtime?.dispose(); }
}
