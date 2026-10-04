<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-938.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-938" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-939" v-if="model.visible('vn-939')" :style="model.style('vn-939')" v-bind="model.attrs('vn-939')" v-on="model.on('vn-939')">
  <h2 data-design-node="vn-940" v-if="model.visible('vn-940')" :style="model.style('vn-940')">{{ model.text('vn-940') }}</h2>
  <p data-design-node="vn-941" v-if="model.visible('vn-941')" :style="model.style('vn-941')">{{ model.text('vn-941') }}</p>
  <UInput data-design-node="vn-942" v-if="model.visible('vn-942')" :style="model.style('vn-942')" :aria-description="model.a11y('vn-942')" v-bind="model.props('vn-942')" v-on="model.on('vn-942')"></UInput>
  <UInput data-design-node="vn-943" v-if="model.visible('vn-943')" :style="model.style('vn-943')" :aria-description="model.a11y('vn-943')" v-bind="model.props('vn-943')" v-on="model.on('vn-943')"></UInput>
  <UInput data-design-node="vn-944" v-if="model.visible('vn-944')" :style="model.style('vn-944')" :aria-description="model.a11y('vn-944')" v-bind="model.props('vn-944')" v-on="model.on('vn-944')"></UInput>
  <StatusNotice data-design-node="vn-945" v-if="model.visible('vn-945')" :style="model.style('vn-945')" v-bind="model.props('vn-945')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-945')">
    <template #details>
      <p data-design-node="vn-946" v-if="model.visible('vn-946')" :style="model.style('vn-946')">{{ model.text('vn-946') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-947" v-if="model.visible('vn-947')" :style="model.style('vn-947')" v-bind="model.attrs('vn-947')" v-on="model.on('vn-947')">
    <UButton data-design-node="vn-948" v-if="model.visible('vn-948')" :style="model.style('vn-948')" v-bind="model.props('vn-948')" v-on="model.on('vn-948')"></UButton>
    <UButton data-design-node="vn-949" v-if="model.visible('vn-949')" :style="model.style('vn-949')" v-bind="model.props('vn-949')" v-on="model.on('vn-949')"></UButton>
  </div>
  <UAlert data-design-node="vn-950" v-if="model.visible('vn-950')" :style="model.style('vn-950')" v-bind="model.props('vn-950')" v-on="model.on('vn-950')"></UAlert>
  <UButton data-design-node="vn-951" v-if="model.visible('vn-951')" :style="model.style('vn-951')" v-bind="model.props('vn-951')" v-on="model.on('vn-951')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
