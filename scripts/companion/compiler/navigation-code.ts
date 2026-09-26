import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
export function navigationCode(m: Model, add: Add): void {
  const root = m.sourceRoot; const test = `${m.testRoot}/navigation.test.ts`;
  add(`${root}/domain/screens.ts`,`export interface Screen { id: string; slug: string; label: string; kind: string; parent: string | null; nav: boolean; entry: boolean; command: boolean; ribbon: boolean; goal: string; components: string[] }\nexport interface Interaction { id: string; from: string; to: string; label: string; kind: string }\nexport const screens: Screen[] = ${literal(m.screens)};\nexport const interactions: Interaction[] = ${literal(m.links)};\n`,'managed');
  add(`${root}/presentation/stores/navigation.ts`,`import { defineStore } from 'pinia';
import { screens, interactions } from '../../domain/screens.ts';
export const useNavigation = defineStore(${literal(String(m.project.id)+':navigation')}, {
  state: () => ({ current: screens.find(s => s.nav && !['group','action','modal'].includes(s.kind))?.id ?? screens.find(s => !['group','action','modal'].includes(s.kind))!.id, history: [] as string[] }),
  actions: {
    open(id: string) {
      const screen = screens.find(s => s.id === id);
      if (!screen || ['action','group'].includes(screen.kind)) throw new Error('SCREEN_NOT_NAVIGABLE');
      if (this.current !== id) { this.history.push(this.current); this.current = id; }
    },
    back() { const id = this.history.pop(); if (id) this.current = id; },
    follow(id: string) {
      const edge = interactions.find(e => e.id === id && e.from === this.current);
      if (!edge) throw new Error('INTERACTION_NOT_AVAILABLE');
      const target = screens.find(s => s.id === edge.to)!;
      if (!['navigate','open'].includes(edge.kind) || ['action','group'].includes(target.kind)) return {kind:'unimplemented',target:target.id};
      if (target.kind === 'modal') return {kind:'modal',target:target.id};
      this.open(target.id); return {kind:'navigate',target:target.id};
    },
  },
});
`);
  const cases = m.links.map(edge => {
    const target = m.screens.find(s => s.id === edge.to)!;
    if (!['navigate','open'].includes(String(edge.kind)) || ['action','group'].includes(target.kind) || m.screens.some(s=>s.id===edge.from && ['action','group'].includes(s.kind))) return `it.todo(${literal('['+edge.id+'] '+edge.label+' requires business interaction behavior')});`;
    return `it(${literal('['+edge.id+'] '+edge.label)}, () => { const pinia = createPinia(); try { const nav = useNavigation(pinia); nav.open(${literal(edge.from)}); const result = nav.follow(${literal(edge.id)}); expect(result).toEqual({kind:${literal(target.kind === 'modal' ? 'modal' : 'navigate')},target:${literal(target.id)}}); expect(nav.current).toBe(${literal(target.kind === 'modal' ? edge.from : target.id)}); } finally { disposePinia(pinia); } });`;
  });
  add(test,`import { it, expect } from 'vitest';\nimport { createPinia, disposePinia } from 'pinia';\nimport { useNavigation } from ${literal(relativeImport(test,`${root}/presentation/stores/navigation.ts`))};\n${cases.join('\n')}\nit('refuses unknown screens without changing state', () => { const pinia = createPinia(); try { const nav = useNavigation(pinia); const before = nav.current; expect(() => nav.open('missing')).toThrow('SCREEN_NOT_NAVIGABLE'); expect(nav.current).toBe(before); } finally { disposePinia(pinia); } });\n`);
}
