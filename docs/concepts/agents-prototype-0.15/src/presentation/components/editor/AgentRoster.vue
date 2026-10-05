<script setup lang="ts">
import type { Agent } from '../../../domain/agents/types'
import CharacterThumbnail from './CharacterThumbnail.vue'
defineProps<{ agents: Agent[]; selectedAgentId: string }>()
const emit=defineEmits<{select:[id:string];add:[]}>()
</script>
<template>
<aside class="creator-roster" aria-label="Agent roster">
  <div class="creator-roster-label">Agents</div>
  <button v-for="item in agents" :key="item.id" class="creator-avatar" :class="{active:item.id===selectedAgentId}" :aria-pressed="item.id===selectedAgentId" @click="emit('select',item.id)">
    <span class="creator-avatar-thumbnail" :style="{'--agent-accent':item.appearance.accentColor}"><CharacterThumbnail :appearance="item.appearance" :size="66"/></span>
    <span class="creator-avatar-name">{{item.appearance.teamNickname||item.name}}</span>
    <span class="creator-avatar-role">{{item.kind==='general'?'General':item.appearance.category}}</span>
    <span v-if="item.kind==='general'" class="creator-general-dot"/>
  </button>
  <button class="creator-add" aria-label="Add specialist" @click="emit('add')"><span>＋</span><small>New agent</small></button>
</aside>
</template>
