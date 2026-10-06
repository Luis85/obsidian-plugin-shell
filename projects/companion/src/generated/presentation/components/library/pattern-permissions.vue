<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-permissions.ts";
import { specification as spec } from "../../../domain/visual/vc-98.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UTable from "@nuxt/ui/components/Table.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name) => {
  switch (name) {
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-98" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-454" v-if="model.visible('vn-454')" :style="model.style('vn-454')" v-bind="model.attrs('vn-454')" v-on="model.on('vn-454')">
  <h2 data-design-node="vn-455" v-if="model.visible('vn-455')" :style="model.style('vn-455')">{{ model.text('vn-455') }}</h2>
  <UTable data-design-node="vn-456" v-if="model.visible('vn-456')" :style="model.style('vn-456')" v-bind="model.props('vn-456')" v-on="model.on('vn-456')">
    <template #empty>
      <p data-design-node="vn-459" v-if="model.visible('vn-459')">{{ model.text('vn-459') }}</p>
    </template>
  </UTable>
  <div data-design-node="vn-457" v-if="model.visible('vn-457')" :style="model.style('vn-457')">
    <slot name="content">
      <p data-design-node="vn-460" v-if="model.visible('vn-460')">{{ model.text('vn-460') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-458" v-if="model.visible('vn-458')" :style="model.style('vn-458')" v-bind="model.props('vn-458')" v-on="model.on('vn-458')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
