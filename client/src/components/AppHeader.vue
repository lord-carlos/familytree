<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <header class="app-header">{{ title }}</header>
</template>

<style src="./AppHeader.css" scoped></style>
