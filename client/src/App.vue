<script setup lang="ts">
import FamilyChart from './components/FamilyChart.vue'
import AppHeader from './components/AppHeader.vue'

const pageTitle = import.meta.env.VITE_PAGE_TITLE || 'Family Tree'
</script>

<template>
  <main class="app">
    <AppHeader :title="pageTitle" />
    <FamilyChart />
  </main>
</template>

<style src="./App.css" scoped></style>
