<script setup>
import Icon from './Icon.vue'
defineProps({ icon: String, label: String, active: Boolean, disabled: Boolean })
</script>
<template><UButton color="neutral" :variant="active ? 'soft' : 'ghost'" :aria-label="label" :title="label" :disabled="disabled" class="tool-button" :class="{ 'is-active': active }"><Icon :name="icon" /></UButton></template>
