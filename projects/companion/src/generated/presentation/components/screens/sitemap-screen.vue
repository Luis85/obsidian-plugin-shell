<script setup lang="ts">
import { useId } from 'vue';
import JourneyWorkspace from '../../journey/workspace/JourneyWorkspace.vue';
const heading = useId(), label = "Sitemap & views";
</script>
<template><section class="generated-screen" :aria-labelledby="heading"><h2 :id="heading">{{ label }}</h2><JourneyWorkspace /></section></template>
