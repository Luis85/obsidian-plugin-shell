<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-814.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-814" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-815" v-if="model.visible('vn-815')" :style="model.style('vn-815')" v-bind="model.attrs('vn-815')" v-on="model.on('vn-815')">
  <h2 data-design-node="vn-816" v-if="model.visible('vn-816')" :style="model.style('vn-816')">{{ model.text('vn-816') }}</h2>
  <p data-design-node="vn-817" v-if="model.visible('vn-817')" :style="model.style('vn-817')">{{ model.text('vn-817') }}</p>
  <UInput data-design-node="vn-818" v-if="model.visible('vn-818')" :style="model.style('vn-818')" :aria-description="model.a11y('vn-818')" v-bind="model.props('vn-818')" v-on="model.on('vn-818')"></UInput>
  <UTable data-design-node="vn-819" v-if="model.visible('vn-819')" :style="model.style('vn-819')" v-bind="model.props('vn-819')" v-on="model.on('vn-819')">
    <template #empty>
      <p data-design-node="vn-827" v-if="model.visible('vn-827')">{{ model.text('vn-827') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-820" v-if="model.visible('vn-820')" :style="model.style('vn-820')" v-bind="model.props('vn-820')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-820')">
    <template #details>
      <p data-design-node="vn-821" v-if="model.visible('vn-821')" :style="model.style('vn-821')">{{ model.text('vn-821') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-822" v-if="model.visible('vn-822')" :style="model.style('vn-822')" v-bind="model.attrs('vn-822')" v-on="model.on('vn-822')">
    <UButton data-design-node="vn-823" v-if="model.visible('vn-823')" :style="model.style('vn-823')" v-bind="model.props('vn-823')" v-on="model.on('vn-823')"></UButton>
    <UButton data-design-node="vn-824" v-if="model.visible('vn-824')" :style="model.style('vn-824')" v-bind="model.props('vn-824')" v-on="model.on('vn-824')"></UButton>
  </div>
  <UAlert data-design-node="vn-825" v-if="model.visible('vn-825')" :style="model.style('vn-825')" v-bind="model.props('vn-825')" v-on="model.on('vn-825')"></UAlert>
  <UButton data-design-node="vn-826" v-if="model.visible('vn-826')" :style="model.style('vn-826')" v-bind="model.props('vn-826')" v-on="model.on('vn-826')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
