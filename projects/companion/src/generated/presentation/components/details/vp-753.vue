<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-753.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import DesignTokenEditor from "../library/design-token-editor.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-753" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-754" v-if="model.visible('vn-754')" :style="model.style('vn-754')" v-bind="model.attrs('vn-754')" v-on="model.on('vn-754')">
  <h2 data-design-node="vn-755" v-if="model.visible('vn-755')" :style="model.style('vn-755')">{{ model.text('vn-755') }}</h2>
  <p data-design-node="vn-756" v-if="model.visible('vn-756')" :style="model.style('vn-756')">{{ model.text('vn-756') }}</p>
  <UInput data-design-node="vn-757" v-if="model.visible('vn-757')" :style="model.style('vn-757')" :aria-description="model.a11y('vn-757')" v-bind="model.props('vn-757')" v-on="model.on('vn-757')"></UInput>
  <UTable data-design-node="vn-758" v-if="model.visible('vn-758')" :style="model.style('vn-758')" v-bind="model.props('vn-758')" v-on="model.on('vn-758')">
    <template #empty>
      <p data-design-node="vn-766" v-if="model.visible('vn-766')">{{ model.text('vn-766') }}</p>
    </template>
  </UTable>
  <DesignTokenEditor data-design-node="vn-759" v-if="model.visible('vn-759')" :style="model.style('vn-759')" v-bind="model.props('vn-759')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-759')">
    <template #content>
      <p data-design-node="vn-760" v-if="model.visible('vn-760')" :style="model.style('vn-760')">{{ model.text('vn-760') }}</p>
    </template>
  </DesignTokenEditor>
  <div data-design-node="vn-761" v-if="model.visible('vn-761')" :style="model.style('vn-761')" v-bind="model.attrs('vn-761')" v-on="model.on('vn-761')">
    <UButton data-design-node="vn-762" v-if="model.visible('vn-762')" :style="model.style('vn-762')" v-bind="model.props('vn-762')" v-on="model.on('vn-762')"></UButton>
    <UButton data-design-node="vn-763" v-if="model.visible('vn-763')" :style="model.style('vn-763')" v-bind="model.props('vn-763')" v-on="model.on('vn-763')"></UButton>
  </div>
  <UAlert data-design-node="vn-764" v-if="model.visible('vn-764')" :style="model.style('vn-764')" v-bind="model.props('vn-764')" v-on="model.on('vn-764')"></UAlert>
  <UButton data-design-node="vn-765" v-if="model.visible('vn-765')" :style="model.style('vn-765')" v-bind="model.props('vn-765')" v-on="model.on('vn-765')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
