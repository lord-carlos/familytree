<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FamilyChart from './components/FamilyChart.vue'
import AppHeader from './components/AppHeader.vue'
import Toast from './components/Toast.vue'
import Login from './components/Login.vue'
import { useAuth } from './composables/useAuth'

const pageTitle = import.meta.env.VITE_PAGE_TITLE || 'Family Tree'
const familyChartRef = ref<InstanceType<typeof FamilyChart>>()
const { isAuthenticated, isChecking, checkAuth } = useAuth()

function handleToggleOrientation() {
  familyChartRef.value?.toggleOrientation()
}

onMounted(() => {
  checkAuth()
})
</script>

<template>
  <div v-if="isChecking" class="app">
    <div class="checking-auth">Loading...</div>
  </div>
  <Login v-else-if="!isAuthenticated" />
  <main v-else class="app">
    <AppHeader :title="pageTitle" @toggle-orientation="handleToggleOrientation" />
    <FamilyChart ref="familyChartRef" />
    <Toast />
  </main>
</template>

<style src="./App.css" scoped></style>
