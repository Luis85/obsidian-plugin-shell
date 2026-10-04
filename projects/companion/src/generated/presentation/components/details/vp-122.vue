<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-122.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UTable from "@nuxt/ui/components/Table.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-122" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-123" v-if="model.visible('vn-123')" :style="model.style('vn-123')" v-bind="model.attrs('vn-123')" v-on="model.on('vn-123')">
  <UTable data-design-node="vn-124" v-if="model.visible('vn-124')" :style="model.style('vn-124')" v-bind="model.props('vn-124')" v-on="model.on('vn-124')">
    <template #empty>
      <p data-design-node="vn-126" v-if="model.visible('vn-126')">{{ model.text('vn-126') }}</p>
    </template>
  </UTable>
  <UButton data-design-node="vn-125" v-if="model.visible('vn-125')" :style="model.style('vn-125')" v-bind="model.props('vn-125')" v-on="model.on('vn-125')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
