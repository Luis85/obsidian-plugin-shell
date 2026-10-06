<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-table.ts";
import { specification as spec } from "../../../domain/visual/vc-66.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-66" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-213" v-if="model.visible('vn-213')" :style="model.style('vn-213')" v-bind="model.attrs('vn-213')" v-on="model.on('vn-213')">
  <h2 data-design-node="vn-214" v-if="model.visible('vn-214')" :style="model.style('vn-214')">{{ model.text('vn-214') }}</h2>
  <UTable data-design-node="vn-215" v-if="model.visible('vn-215')" :style="model.style('vn-215')" v-bind="model.props('vn-215')" v-on="model.on('vn-215')">
    <template #empty>
      <p data-design-node="vn-218" v-if="model.visible('vn-218')">{{ model.text('vn-218') }}</p>
    </template>
  </UTable>
  <div data-design-node="vn-216" v-if="model.visible('vn-216')" :style="model.style('vn-216')">
    <slot name="content">
      <p data-design-node="vn-219" v-if="model.visible('vn-219')">{{ model.text('vn-219') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-217" v-if="model.visible('vn-217')" :style="model.style('vn-217')" v-bind="model.props('vn-217')" v-on="model.on('vn-217')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
