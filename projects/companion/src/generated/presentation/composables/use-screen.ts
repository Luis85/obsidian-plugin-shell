import { onMounted, ref, useId } from 'vue';
import { screens, interactions } from '../../domain/screens.ts';
import { useProject } from '../context/project.ts';
import { useNavigation } from '../stores/navigation.ts';
export function useScreen(id: string) {
  const context = useProject(); const navigation = useNavigation(); const headingId = useId(); const message = ref('');
  const screen = screens.find(s => s.id === id); if (!screen) throw new Error('SCREEN_MISSING');
  const edges = interactions.filter(e => e.from === id); const flows = context.flows.filter(f => f.card === id);
  onMounted(() => { for (const flow of flows) if (flow.trigger === 'on-open' && flow.direction === 'read' && !flow.requiresInput) void flow.run(); });
  function follow(edge: string) { const result = navigation.follow(edge); if (result.kind === 'modal') context.openModal(result.target); if (result.kind === 'unimplemented') message.value = 'Implement this interaction before enabling business behavior.'; }
  return {screen,edges,flows,headingId,message,follow};
}
