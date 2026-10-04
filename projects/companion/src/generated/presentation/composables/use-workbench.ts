import { useProject } from '../context/project.ts';
import { screens } from '../../domain/screens.ts';
import { useNavigation } from '../stores/navigation.ts';
export function useWorkbench() { const context = useProject(); const navigation = useNavigation(); if (context.initial) navigation.open(context.initial); return {context,navigation,items:screens.filter(s => s.nav && !['group','action','modal'].includes(s.kind))}; }
