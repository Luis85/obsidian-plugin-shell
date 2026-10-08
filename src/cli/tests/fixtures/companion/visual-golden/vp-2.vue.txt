<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-2.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import SearchField from "../library/library-search.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-2" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<main data-design-node="vn-18" v-if="model.visible('vn-18')" :style="model.style('vn-18')" v-bind="model.attrs('vn-18')" v-on="model.on('vn-18')">
  <p data-design-node="vn-25" v-if="model.visible('vn-25')" :style="model.style('vn-25')">{{ model.text('vn-25') }}</p>
  <h1 data-design-node="vn-14" v-if="model.visible('vn-14')">{{ model.text('vn-14') }}</h1>
  <SearchField data-design-node="vn-10" v-if="model.visible('vn-10')" :aria-description="model.a11y('vn-10')" v-bind="model.props('vn-10')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-10')">
    <template #actions>
      <UButton data-design-node="vn-11" v-if="model.visible('vn-11')" v-bind="model.props('vn-11')" v-on="model.on('vn-11')"></UButton>
    </template>
  </SearchField>
  <UTable data-design-node="vn-8" v-if="model.visible('vn-8')" v-bind="model.props('vn-8')" v-on="model.on('vn-8')"></UTable>
  <UAlert data-design-node="vn-9" v-if="model.visible('vn-9')" v-bind="model.props('vn-9')" v-on="model.on('vn-9')"></UAlert>
  <UButton data-design-node="vn-15" v-if="model.visible('vn-15')" v-bind="model.props('vn-15')" v-on="model.on('vn-15')"></UButton>
</main>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
