<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/workflow-rail.ts";
import { specification as spec } from "../../../domain/visual/vc-99.ts";
import UButton from "@nuxt/ui/components/Button.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-99" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-462" v-if="model.visible('vn-462')" :style="model.style('vn-462')" v-bind="model.attrs('vn-462')" v-on="model.on('vn-462')">
  <h2 data-design-node="vn-463" v-if="model.visible('vn-463')" :style="model.style('vn-463')">{{ model.text('vn-463') }}</h2>
  <ul data-design-node="vn-464" v-if="model.visible('vn-464')" :style="model.style('vn-464')" v-bind="model.attrs('vn-464')" v-on="model.on('vn-464')">
    <li data-design-node="vn-467" v-if="model.visible('vn-467')" v-bind="model.attrs('vn-467')" v-on="model.on('vn-467')">
      <span data-design-node="vn-468" v-if="model.visible('vn-468')">{{ model.text('vn-468') }}</span>
    </li>
    <li data-design-node="vn-469" v-if="model.visible('vn-469')" v-bind="model.attrs('vn-469')" v-on="model.on('vn-469')">
      <span data-design-node="vn-470" v-if="model.visible('vn-470')">{{ model.text('vn-470') }}</span>
    </li>
  </ul>
  <div data-design-node="vn-465" v-if="model.visible('vn-465')" :style="model.style('vn-465')">
    <slot name="content">
      <p data-design-node="vn-471" v-if="model.visible('vn-471')">{{ model.text('vn-471') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-466" v-if="model.visible('vn-466')" :style="model.style('vn-466')" v-bind="model.props('vn-466')" v-on="model.on('vn-466')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
