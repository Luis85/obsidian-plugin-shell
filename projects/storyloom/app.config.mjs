// The one product-family editor this project builds. The shared shell (src/) is the same in all four projects.
export const APP=Object.freeze({appId:'storyloom',file:'storyloom-prototype.html',title:'Storyloom'});
export const VERSION='2.0.0';
export const UI_VERSION='4.11.3';
// Nuxt UI components are registered as <PfButton>, not with the default U prefix. The Workbench shell's Nuxt UI component detection
// scans the whole checkout for that default; this prefix keeps the family's components out of the shell plugin's CSS.
export const COMPONENT_PREFIX='Pf';
