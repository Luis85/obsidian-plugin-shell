<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/review-findings.ts";
import { specification as spec } from "../../../domain/visual/vc-100.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UTable from "@nuxt/ui/components/Table.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "select": if (typeof payload === "string") { emit("select", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "cancel": if (payload === undefined) { emit("cancel", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-100" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-473" v-if="model.visible('vn-473')" :style="model.style('vn-473')" v-bind="model.attrs('vn-473')" v-on="model.on('vn-473')">
  <h2 data-design-node="vn-474" v-if="model.visible('vn-474')" :style="model.style('vn-474')">{{ model.text('vn-474') }}</h2>
  <UTable data-design-node="vn-475" v-if="model.visible('vn-475')" :style="model.style('vn-475')" v-bind="model.props('vn-475')" v-on="model.on('vn-475')">
    <template #empty>
      <p data-design-node="vn-478" v-if="model.visible('vn-478')">{{ model.text('vn-478') }}</p>
    </template>
  </UTable>
  <div data-design-node="vn-476" v-if="model.visible('vn-476')" :style="model.style('vn-476')">
    <slot name="content">
      <p data-design-node="vn-479" v-if="model.visible('vn-479')">{{ model.text('vn-479') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-477" v-if="model.visible('vn-477')" :style="model.style('vn-477')" v-bind="model.props('vn-477')" v-on="model.on('vn-477')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
