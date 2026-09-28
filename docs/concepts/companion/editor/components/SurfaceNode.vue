<script setup lang="ts">
import type { Component } from 'vue';
import type { ProjectedSurface } from '../../../../../scripts/companion/sitemap/projection.ts';
defineProps<{ id:string; data:ProjectedSurface; selected?:boolean }>();
const Handle:Component=window.VueFlowCore.Handle;
const Position=window.VueFlowCore.Position;
</script>
<template>
  <article class="jm-node" :class="{selected,dim:!data.matched,journey:data.journeySteps.length}" :data-surface="id">
    <Handle type="target" :position="Position.Top" />
    <span class="jm-kind">{{ data.kind==='view'?'Native view':data.kind==='page'?'Page':data.kind }}</span>
    <strong>{{ data.label }}</strong>
    <code v-if="data.route">{{ data.route }}</code><small v-else>{{ data.kind==='page'?'Internal surface':data.kind==='view'?'Workspace entry':'Contextual surface' }}</small>
    <span v-if="data.journeySteps.length" class="jm-step">{{ data.journeySteps.join(' · ') }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </article>
</template>
