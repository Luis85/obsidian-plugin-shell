<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-904.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-904" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-905" v-if="model.visible('vn-905')" :style="model.style('vn-905')" v-bind="model.attrs('vn-905')" v-on="model.on('vn-905')">
  <h2 data-design-node="vn-906" v-if="model.visible('vn-906')" :style="model.style('vn-906')">{{ model.text('vn-906') }}</h2>
  <p data-design-node="vn-907" v-if="model.visible('vn-907')" :style="model.style('vn-907')">{{ model.text('vn-907') }}</p>
  <UInput data-design-node="vn-908" v-if="model.visible('vn-908')" :style="model.style('vn-908')" :aria-description="model.a11y('vn-908')" v-bind="model.props('vn-908')" v-on="model.on('vn-908')"></UInput>
  <UTable data-design-node="vn-909" v-if="model.visible('vn-909')" :style="model.style('vn-909')" v-bind="model.props('vn-909')" v-on="model.on('vn-909')">
    <template #empty>
      <p data-design-node="vn-917" v-if="model.visible('vn-917')">{{ model.text('vn-917') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-910" v-if="model.visible('vn-910')" :style="model.style('vn-910')" v-bind="model.props('vn-910')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-910')">
    <template #details>
      <p data-design-node="vn-911" v-if="model.visible('vn-911')" :style="model.style('vn-911')">{{ model.text('vn-911') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-912" v-if="model.visible('vn-912')" :style="model.style('vn-912')" v-bind="model.attrs('vn-912')" v-on="model.on('vn-912')">
    <UButton data-design-node="vn-913" v-if="model.visible('vn-913')" :style="model.style('vn-913')" v-bind="model.props('vn-913')" v-on="model.on('vn-913')"></UButton>
    <UButton data-design-node="vn-914" v-if="model.visible('vn-914')" :style="model.style('vn-914')" v-bind="model.props('vn-914')" v-on="model.on('vn-914')"></UButton>
  </div>
  <UAlert data-design-node="vn-915" v-if="model.visible('vn-915')" :style="model.style('vn-915')" v-bind="model.props('vn-915')" v-on="model.on('vn-915')"></UAlert>
  <UButton data-design-node="vn-916" v-if="model.visible('vn-916')" :style="model.style('vn-916')" v-bind="model.props('vn-916')" v-on="model.on('vn-916')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
