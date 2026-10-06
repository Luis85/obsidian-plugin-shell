<script setup lang="ts">
import { useScreen } from '../../composables/use-screen.ts';
import Detail from '../details/vp-814.vue';
const props = defineProps<{ designState?: 'default' | 'loading' | 'empty' | 'error' | 'disabled' }>();
const model = useScreen("node-35");
</script>
<template><section class="generated-screen" :aria-labelledby="model.headingId">
<h2 :id="model.headingId">{{ model.screen.label }}</h2><p>{{ model.screen.goal }}</p>
<Detail :design-state="props.designState" />
<button v-for="edge in model.edges" :key="edge.id" type="button" @click="model.follow(edge.id)">{{ edge.label }}</button>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section></template>
