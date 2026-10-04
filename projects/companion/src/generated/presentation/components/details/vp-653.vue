<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-653.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-653" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-654" v-if="model.visible('vn-654')" :style="model.style('vn-654')" v-bind="model.attrs('vn-654')" v-on="model.on('vn-654')">
  <h2 data-design-node="vn-655" v-if="model.visible('vn-655')" :style="model.style('vn-655')">{{ model.text('vn-655') }}</h2>
  <p data-design-node="vn-656" v-if="model.visible('vn-656')" :style="model.style('vn-656')">{{ model.text('vn-656') }}</p>
  <UInput data-design-node="vn-657" v-if="model.visible('vn-657')" :style="model.style('vn-657')" :aria-description="model.a11y('vn-657')" v-bind="model.props('vn-657')" v-on="model.on('vn-657')"></UInput>
  <UTable data-design-node="vn-658" v-if="model.visible('vn-658')" :style="model.style('vn-658')" v-bind="model.props('vn-658')" v-on="model.on('vn-658')">
    <template #empty>
      <p data-design-node="vn-666" v-if="model.visible('vn-666')">{{ model.text('vn-666') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-659" v-if="model.visible('vn-659')" :style="model.style('vn-659')" v-bind="model.props('vn-659')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-659')">
    <template #details>
      <p data-design-node="vn-660" v-if="model.visible('vn-660')" :style="model.style('vn-660')">{{ model.text('vn-660') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-661" v-if="model.visible('vn-661')" :style="model.style('vn-661')" v-bind="model.attrs('vn-661')" v-on="model.on('vn-661')">
    <UButton data-design-node="vn-662" v-if="model.visible('vn-662')" :style="model.style('vn-662')" v-bind="model.props('vn-662')" v-on="model.on('vn-662')"></UButton>
    <UButton data-design-node="vn-663" v-if="model.visible('vn-663')" :style="model.style('vn-663')" v-bind="model.props('vn-663')" v-on="model.on('vn-663')"></UButton>
  </div>
  <UAlert data-design-node="vn-664" v-if="model.visible('vn-664')" :style="model.style('vn-664')" v-bind="model.props('vn-664')" v-on="model.on('vn-664')"></UAlert>
  <UButton data-design-node="vn-665" v-if="model.visible('vn-665')" :style="model.style('vn-665')" v-bind="model.props('vn-665')" v-on="model.on('vn-665')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
