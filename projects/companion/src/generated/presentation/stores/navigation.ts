import { defineStore } from 'pinia';
import { screens, interactions } from '../../domain/screens.ts';
export const useNavigation = defineStore("workbench-companion:navigation", {
  state: () => ({ current: screens.find(s => s.nav && !['group','action','modal'].includes(s.kind))?.id ?? screens.find(s => !['group','action','modal'].includes(s.kind))!.id, history: [] as string[], leaveGuard: null as (() => boolean) | null }),
  actions: {
    open(id: string) {
      const screen = screens.find(s => s.id === id);
      if (!screen || ['action','group'].includes(screen.kind)) throw new Error('SCREEN_NOT_NAVIGABLE');
      if (this.current !== id && this.leaveGuard && !this.leaveGuard()) return;
      if (this.current !== id) { this.history.push(this.current); this.current = id; }
    },
    back() { if (this.leaveGuard && !this.leaveGuard()) return; const id = this.history.pop(); if (id) this.current = id; },
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
