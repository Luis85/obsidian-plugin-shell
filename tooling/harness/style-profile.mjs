/** Explicit document-local host profile, shared by HTTP and inline test adapters. */
export const hostFiles = {
  extracted: ['src/plugin/harness/styles/vendor/obsidian.css', 'src/plugin/harness/styles/host-adapter.css'],
  simulated: ['tokens','base','controls','overlays','accessibility'].map((n) => `harness/styles/obsidian/${n}.css`),
};
export const pluginStyleFiles = ['src/plugin/styles/tokens.css'];
export function assertProfile(profile) {
  if (!Object.hasOwn(hostFiles, profile)) throw new Error('UNKNOWN_HOST_STYLE_PROFILE');
  return profile;
}
export function profilePage(profile) {
  assertProfile(profile);
  return profile === 'extracted' ? 'src/plugin/harness/style-fixture/index.html' : 'src/plugin/harness/style-fixture/simulated.html';
}
