<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-conversation.ts";
import { specification as spec } from "../../../domain/visual/vc-95.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-95" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-429" v-if="model.visible('vn-429')" :style="model.style('vn-429')" v-bind="model.attrs('vn-429')" v-on="model.on('vn-429')">
  <h2 data-design-node="vn-430" v-if="model.visible('vn-430')" :style="model.style('vn-430')">{{ model.text('vn-430') }}</h2>
  <ul data-design-node="vn-431" v-if="model.visible('vn-431')" :style="model.style('vn-431')" v-bind="model.attrs('vn-431')" v-on="model.on('vn-431')">
    <li data-design-node="vn-434" v-if="model.visible('vn-434')" v-bind="model.attrs('vn-434')" v-on="model.on('vn-434')">
      <span data-design-node="vn-435" v-if="model.visible('vn-435')">{{ model.text('vn-435') }}</span>
    </li>
    <li data-design-node="vn-436" v-if="model.visible('vn-436')" v-bind="model.attrs('vn-436')" v-on="model.on('vn-436')">
      <span data-design-node="vn-437" v-if="model.visible('vn-437')">{{ model.text('vn-437') }}</span>
    </li>
  </ul>
  <div data-design-node="vn-432" v-if="model.visible('vn-432')" :style="model.style('vn-432')">
    <slot name="content">
      <p data-design-node="vn-438" v-if="model.visible('vn-438')">{{ model.text('vn-438') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-433" v-if="model.visible('vn-433')" :style="model.style('vn-433')" v-bind="model.props('vn-433')" v-on="model.on('vn-433')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
