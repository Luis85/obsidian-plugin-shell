<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/project-json-review.ts";
import { specification as spec } from "../../../domain/visual/vc-107.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-107" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-109" v-if="model.visible('vn-109')" :style="model.style('vn-109')" v-bind="model.attrs('vn-109')" v-on="model.on('vn-109')">
  <p data-design-node="vn-110" v-if="model.visible('vn-110')" :style="model.style('vn-110')">{{ model.text('vn-110') }}</p>
  <div data-design-node="vn-111" v-if="model.visible('vn-111')" :style="model.style('vn-111')">
    <slot name="content">
      <p data-design-node="vn-113" v-if="model.visible('vn-113')">{{ model.text('vn-113') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-112" v-if="model.visible('vn-112')" :style="model.style('vn-112')" :aria-description="model.a11y('vn-112')" v-bind="model.props('vn-112')" v-on="model.on('vn-112')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
