<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-activity-timeline.ts";
import { specification as spec } from "../../../domain/visual/vc-90.ts";
import UButton from "@nuxt/ui/components/Button.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-90" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-390" v-if="model.visible('vn-390')" :style="model.style('vn-390')" v-bind="model.attrs('vn-390')" v-on="model.on('vn-390')">
  <h2 data-design-node="vn-391" v-if="model.visible('vn-391')" :style="model.style('vn-391')">{{ model.text('vn-391') }}</h2>
  <ul data-design-node="vn-392" v-if="model.visible('vn-392')" :style="model.style('vn-392')" v-bind="model.attrs('vn-392')" v-on="model.on('vn-392')">
    <li data-design-node="vn-395" v-if="model.visible('vn-395')" v-bind="model.attrs('vn-395')" v-on="model.on('vn-395')">
      <span data-design-node="vn-396" v-if="model.visible('vn-396')">{{ model.text('vn-396') }}</span>
    </li>
    <li data-design-node="vn-397" v-if="model.visible('vn-397')" v-bind="model.attrs('vn-397')" v-on="model.on('vn-397')">
      <span data-design-node="vn-398" v-if="model.visible('vn-398')">{{ model.text('vn-398') }}</span>
    </li>
  </ul>
  <div data-design-node="vn-393" v-if="model.visible('vn-393')" :style="model.style('vn-393')">
    <slot name="content">
      <p data-design-node="vn-399" v-if="model.visible('vn-399')">{{ model.text('vn-399') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-394" v-if="model.visible('vn-394')" :style="model.style('vn-394')" v-bind="model.props('vn-394')" v-on="model.on('vn-394')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
