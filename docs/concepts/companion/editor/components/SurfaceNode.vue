<script setup lang="ts">
import { useFlowRuntime } from '../flow-context.ts';
import type { Component } from 'vue';
import type { ProjectedSurface } from '../../../../../scripts/companion/sitemap/projection.ts';
defineProps<{ id:string; data:ProjectedSurface; selected?:boolean }>();
const Handle:Component=useFlowRuntime().Handle;
const Position=useFlowRuntime().Position;
</script>
<template>
  <article class="jm-node" :class="{selected,dim:!data.matched,journey:data.journeySteps.length}" :data-surface="id">
    <Handle type="target" :position="Position.Top" />
    <span class="jm-kind">{{ data.kind==='view'?'Native view':data.kind==='page'?'Page':data.kind }}</span>
    <strong :title="data.label">{{ data.label }}</strong>
    <code v-if="data.route" :title="data.route">{{ data.route }}</code><small v-else>{{ data.kind==='page'?'Internal surface':data.kind==='view'?'Workspace entry':'Contextual surface' }}</small>
    <span v-if="data.journeySteps.length" class="jm-step" :title="data.journeySteps.join(' · ')">{{ data.journeySteps.join(' · ') }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </article>
</template>
