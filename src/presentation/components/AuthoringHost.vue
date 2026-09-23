<script setup lang="ts">
import { useAuthoring } from '../context/authoring-context';
const context = useAuthoring();
</script>

<template>
  <component :is="panel.component" v-for="panel in context.panels" :key="panel.id" v-bind="panel.props" />
</template>
