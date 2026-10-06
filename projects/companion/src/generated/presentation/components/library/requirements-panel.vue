<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/requirements-panel.ts";
import { specification as spec } from "../../../domain/visual/vc-101.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-101" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-481" v-if="model.visible('vn-481')" :style="model.style('vn-481')" v-bind="model.attrs('vn-481')" v-on="model.on('vn-481')">
  <h2 data-design-node="vn-482" v-if="model.visible('vn-482')" :style="model.style('vn-482')">{{ model.text('vn-482') }}</h2>
  <UTable data-design-node="vn-483" v-if="model.visible('vn-483')" :style="model.style('vn-483')" v-bind="model.props('vn-483')" v-on="model.on('vn-483')">
    <template #empty>
      <p data-design-node="vn-486" v-if="model.visible('vn-486')">{{ model.text('vn-486') }}</p>
    </template>
  </UTable>
  <div data-design-node="vn-484" v-if="model.visible('vn-484')" :style="model.style('vn-484')">
    <slot name="content">
      <p data-design-node="vn-487" v-if="model.visible('vn-487')">{{ model.text('vn-487') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-485" v-if="model.visible('vn-485')" :style="model.style('vn-485')" v-bind="model.props('vn-485')" v-on="model.on('vn-485')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
