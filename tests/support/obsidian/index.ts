/**
 * In-memory Obsidian host double. Opt in per test file:
 *   vi.mock('obsidian', () => import('<relative path>/tests/support/obsidian'));
 * Runtime classes imported from 'obsidian' then resolve here, while types stay Obsidian's.
 * Guide: docs/testing/OBSIDIAN-TEST-KIT.md
 */
export { App, CommandRegistry, ViewRegistry, type RibbonItem } from './app';
export { Component, Scope } from './component';
export { installObsidianDom, type DomElementInfo } from './dom';
export { Events, flushObsidian, hostErrors, type KitEventRef } from './events';
export { FileManager } from './file-manager';
export { TAbstractFile, TFile, TFolder, normalizePath } from './files';
export { loadVaultFixtures } from './fixtures';
export { MetadataCache, getAllTags, getLinkpath, parseFrontMatterTags, parseLinktext, parseMarkdownMetadata, parseYaml, splitFrontmatter, stringifyYaml } from './metadata';
export { Plugin } from './plugin';
export { BaseComponent, ButtonComponent, ColorComponent, DropdownComponent, ExtraButtonComponent, SearchComponent, SliderComponent, TextAreaComponent, TextComponent, ToggleComponent, ValueComponent } from './setting-components';
export { PluginSettingTab, Setting, SettingGroup, SettingTab, type KitSettingItem } from './settings';
export { TestApp, createTestApp, hostInstance, type TestAppOptions } from './test-app';
export { Menu, MenuItem, Modal, Notice, Platform, debounce, setIcon, setTooltip } from './ui';
export { TestAdapter, Vault, createTestVault, type TrashRecord } from './vault';
export { ItemView, MarkdownView, View, Workspace, WorkspaceLeaf, type ViewCreator } from './workspace';
