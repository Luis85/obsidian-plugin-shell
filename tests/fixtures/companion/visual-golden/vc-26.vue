<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/library-editor.ts";
import { specification as spec } from "../../../domain/visual/vc-26.ts";
import UCard from "@nuxt/ui/components/Card.vue";
import { createAdapter as createAdapter_0 } from "./library-editor/editor.adapter.ts";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "change": if (typeof payload === "string") { emit("change", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "ready": if (payload === undefined) { emit("ready", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "raw": { emit("raw", payload); return; }
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-26" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<section data-design-node="vn-27" v-if="model.visible('vn-27')" v-bind="model.attrs('vn-27')" v-on="model.on('vn-27')">
  <div data-design-node="vn-28" v-if="model.visible('vn-28')" :style="model.style('vn-28')">
    <slot name="toolbar">
      <span data-design-node="vn-29" v-if="model.visible('vn-29')">{{ model.text('vn-29') }}</span>
    </slot>
  </div>
  <div data-design-node="vn-30" v-if="model.visible('vn-30')" class="generated-external" :ref="model.external('vn-30', createAdapter_0)" />
  <input data-design-node="vn-32" v-if="model.visible('vn-32')" v-bind="model.attrs('vn-32')" v-on="model.on('vn-32')" />
  <UCard data-design-node="vn-34" v-if="model.visible('vn-34')" v-bind="model.props('vn-34')" v-on="model.on('vn-34')">
    <template #header>
      <h3 data-design-node="vn-35" v-if="model.visible('vn-35')">{{ model.text('vn-35') }}</h3>
    </template>
  </UCard>
</section>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
