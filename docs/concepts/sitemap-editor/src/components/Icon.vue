<script setup>
import icons from '../data/icons.json'
defineProps({ name: { type: String, default: 'page' } })
</script>
<template><span class="jl-icon" aria-hidden="true" v-html="icons[name] || icons.page"></span></template>
