<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-604.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-604" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-605" v-if="model.visible('vn-605')" :style="model.style('vn-605')" v-bind="model.attrs('vn-605')" v-on="model.on('vn-605')">
  <h2 data-design-node="vn-606" v-if="model.visible('vn-606')" :style="model.style('vn-606')">{{ model.text('vn-606') }}</h2>
  <p data-design-node="vn-607" v-if="model.visible('vn-607')" :style="model.style('vn-607')">{{ model.text('vn-607') }}</p>
  <UInput data-design-node="vn-608" v-if="model.visible('vn-608')" :style="model.style('vn-608')" :aria-description="model.a11y('vn-608')" v-bind="model.props('vn-608')" v-on="model.on('vn-608')"></UInput>
  <UTable data-design-node="vn-609" v-if="model.visible('vn-609')" :style="model.style('vn-609')" v-bind="model.props('vn-609')" v-on="model.on('vn-609')">
    <template #empty>
      <p data-design-node="vn-617" v-if="model.visible('vn-617')">{{ model.text('vn-617') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-610" v-if="model.visible('vn-610')" :style="model.style('vn-610')" v-bind="model.props('vn-610')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-610')">
    <template #details>
      <p data-design-node="vn-611" v-if="model.visible('vn-611')" :style="model.style('vn-611')">{{ model.text('vn-611') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-612" v-if="model.visible('vn-612')" :style="model.style('vn-612')" v-bind="model.attrs('vn-612')" v-on="model.on('vn-612')">
    <UButton data-design-node="vn-613" v-if="model.visible('vn-613')" :style="model.style('vn-613')" v-bind="model.props('vn-613')" v-on="model.on('vn-613')"></UButton>
    <UButton data-design-node="vn-614" v-if="model.visible('vn-614')" :style="model.style('vn-614')" v-bind="model.props('vn-614')" v-on="model.on('vn-614')"></UButton>
  </div>
  <UAlert data-design-node="vn-615" v-if="model.visible('vn-615')" :style="model.style('vn-615')" v-bind="model.props('vn-615')" v-on="model.on('vn-615')"></UAlert>
  <UButton data-design-node="vn-616" v-if="model.visible('vn-616')" :style="model.style('vn-616')" v-bind="model.props('vn-616')" v-on="model.on('vn-616')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
