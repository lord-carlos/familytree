<script setup lang="ts">
import { ref } from 'vue'
import FamilyChart from './components/FamilyChart.vue'
import AppHeader from './components/AppHeader.vue'

const pageTitle = import.meta.env.VITE_PAGE_TITLE || 'Family Tree'
const familyChartRef = ref<InstanceType<typeof FamilyChart>>()

function handleToggleOrientation() {
  familyChartRef.value?.toggleOrientation()
}
</script>

<template>
  <main class="app">
    <AppHeader :title="pageTitle" @toggle-orientation="handleToggleOrientation" />
    <FamilyChart ref="familyChartRef" />
  </main>
</template>

<style src="./App.css" scoped></style>
