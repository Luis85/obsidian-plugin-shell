<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-621.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTabs from "@nuxt/ui/components/Tabs.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-621" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-622" v-if="model.visible('vn-622')" :style="model.style('vn-622')" v-bind="model.attrs('vn-622')" v-on="model.on('vn-622')">
  <h2 data-design-node="vn-623" v-if="model.visible('vn-623')" :style="model.style('vn-623')">{{ model.text('vn-623') }}</h2>
  <p data-design-node="vn-624" v-if="model.visible('vn-624')" :style="model.style('vn-624')">{{ model.text('vn-624') }}</p>
  <UInput data-design-node="vn-625" v-if="model.visible('vn-625')" :style="model.style('vn-625')" :aria-description="model.a11y('vn-625')" v-bind="model.props('vn-625')" v-on="model.on('vn-625')"></UInput>
  <UTabs data-design-node="vn-626" v-if="model.visible('vn-626')" :style="model.style('vn-626')" v-bind="model.props('vn-626')" v-on="model.on('vn-626')"></UTabs>
  <StatusNotice data-design-node="vn-627" v-if="model.visible('vn-627')" :style="model.style('vn-627')" v-bind="model.props('vn-627')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-627')">
    <template #details>
      <p data-design-node="vn-628" v-if="model.visible('vn-628')" :style="model.style('vn-628')">{{ model.text('vn-628') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-629" v-if="model.visible('vn-629')" :style="model.style('vn-629')" v-bind="model.attrs('vn-629')" v-on="model.on('vn-629')">
    <UButton data-design-node="vn-630" v-if="model.visible('vn-630')" :style="model.style('vn-630')" v-bind="model.props('vn-630')" v-on="model.on('vn-630')"></UButton>
    <UButton data-design-node="vn-631" v-if="model.visible('vn-631')" :style="model.style('vn-631')" v-bind="model.props('vn-631')" v-on="model.on('vn-631')"></UButton>
  </div>
  <UAlert data-design-node="vn-632" v-if="model.visible('vn-632')" :style="model.style('vn-632')" v-bind="model.props('vn-632')" v-on="model.on('vn-632')"></UAlert>
  <UButton data-design-node="vn-633" v-if="model.visible('vn-633')" :style="model.style('vn-633')" v-bind="model.props('vn-633')" v-on="model.on('vn-633')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
