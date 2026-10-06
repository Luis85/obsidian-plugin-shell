import type { InjectionKey } from 'vue'
import type { ApplicationServices } from '../../application/ports/ApplicationServices'
import type { PluginState } from '../../domain/shared/PluginState'
export interface AgentsContext { services: ApplicationServices; initialState: PluginState }
export const agentsContextKey: InjectionKey<AgentsContext> = Symbol('agents-application-context')
