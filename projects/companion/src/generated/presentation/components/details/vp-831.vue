<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-831.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-831" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-832" v-if="model.visible('vn-832')" :style="model.style('vn-832')" v-bind="model.attrs('vn-832')" v-on="model.on('vn-832')">
  <h2 data-design-node="vn-833" v-if="model.visible('vn-833')" :style="model.style('vn-833')">{{ model.text('vn-833') }}</h2>
  <p data-design-node="vn-834" v-if="model.visible('vn-834')" :style="model.style('vn-834')">{{ model.text('vn-834') }}</p>
  <UInput data-design-node="vn-835" v-if="model.visible('vn-835')" :style="model.style('vn-835')" :aria-description="model.a11y('vn-835')" v-bind="model.props('vn-835')" v-on="model.on('vn-835')"></UInput>
  <UTable data-design-node="vn-836" v-if="model.visible('vn-836')" :style="model.style('vn-836')" v-bind="model.props('vn-836')" v-on="model.on('vn-836')">
    <template #empty>
      <p data-design-node="vn-844" v-if="model.visible('vn-844')">{{ model.text('vn-844') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-837" v-if="model.visible('vn-837')" :style="model.style('vn-837')" v-bind="model.props('vn-837')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-837')">
    <template #details>
      <p data-design-node="vn-838" v-if="model.visible('vn-838')" :style="model.style('vn-838')">{{ model.text('vn-838') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-839" v-if="model.visible('vn-839')" :style="model.style('vn-839')" v-bind="model.attrs('vn-839')" v-on="model.on('vn-839')">
    <UButton data-design-node="vn-840" v-if="model.visible('vn-840')" :style="model.style('vn-840')" v-bind="model.props('vn-840')" v-on="model.on('vn-840')"></UButton>
    <UButton data-design-node="vn-841" v-if="model.visible('vn-841')" :style="model.style('vn-841')" v-bind="model.props('vn-841')" v-on="model.on('vn-841')"></UButton>
  </div>
  <UAlert data-design-node="vn-842" v-if="model.visible('vn-842')" :style="model.style('vn-842')" v-bind="model.props('vn-842')" v-on="model.on('vn-842')"></UAlert>
  <UButton data-design-node="vn-843" v-if="model.visible('vn-843')" :style="model.style('vn-843')" v-bind="model.props('vn-843')" v-on="model.on('vn-843')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
