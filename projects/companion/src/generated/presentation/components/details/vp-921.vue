<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-921.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-921" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-922" v-if="model.visible('vn-922')" :style="model.style('vn-922')" v-bind="model.attrs('vn-922')" v-on="model.on('vn-922')">
  <h2 data-design-node="vn-923" v-if="model.visible('vn-923')" :style="model.style('vn-923')">{{ model.text('vn-923') }}</h2>
  <p data-design-node="vn-924" v-if="model.visible('vn-924')" :style="model.style('vn-924')">{{ model.text('vn-924') }}</p>
  <UInput data-design-node="vn-925" v-if="model.visible('vn-925')" :style="model.style('vn-925')" :aria-description="model.a11y('vn-925')" v-bind="model.props('vn-925')" v-on="model.on('vn-925')"></UInput>
  <UTable data-design-node="vn-926" v-if="model.visible('vn-926')" :style="model.style('vn-926')" v-bind="model.props('vn-926')" v-on="model.on('vn-926')">
    <template #empty>
      <p data-design-node="vn-934" v-if="model.visible('vn-934')">{{ model.text('vn-934') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-927" v-if="model.visible('vn-927')" :style="model.style('vn-927')" v-bind="model.props('vn-927')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-927')">
    <template #details>
      <p data-design-node="vn-928" v-if="model.visible('vn-928')" :style="model.style('vn-928')">{{ model.text('vn-928') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-929" v-if="model.visible('vn-929')" :style="model.style('vn-929')" v-bind="model.attrs('vn-929')" v-on="model.on('vn-929')">
    <UButton data-design-node="vn-930" v-if="model.visible('vn-930')" :style="model.style('vn-930')" v-bind="model.props('vn-930')" v-on="model.on('vn-930')"></UButton>
    <UButton data-design-node="vn-931" v-if="model.visible('vn-931')" :style="model.style('vn-931')" v-bind="model.props('vn-931')" v-on="model.on('vn-931')"></UButton>
  </div>
  <UAlert data-design-node="vn-932" v-if="model.visible('vn-932')" :style="model.style('vn-932')" v-bind="model.props('vn-932')" v-on="model.on('vn-932')"></UAlert>
  <UButton data-design-node="vn-933" v-if="model.visible('vn-933')" :style="model.style('vn-933')" v-bind="model.props('vn-933')" v-on="model.on('vn-933')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
