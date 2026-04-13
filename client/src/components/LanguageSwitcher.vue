<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../i18n'
import type { LocaleCode } from '../i18n'

const { locale, setLocale, supportedLocales } = useI18n()
const isOpen = ref(false)
const switcherRef = ref<HTMLElement | null>(null)

function selectLocale(code: LocaleCode) {
  setLocale(code)
  isOpen.value = false
}

function toggle() {
  isOpen.value = !isOpen.value
}

function handleClickOutside(e: MouseEvent) {
  if (switcherRef.value && !switcherRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="language-switcher" ref="switcherRef">
    <button class="lang-btn" @click="toggle" :title="locale">
      {{ locale.toUpperCase() }}
    </button>
    <ul v-if="isOpen" class="lang-dropdown">
      <li
        v-for="loc in supportedLocales"
        :key="loc.code"
        :class="{ active: loc.code === locale }"
        @click="selectLocale(loc.code)"
      >
        {{ loc.label }}
      </li>
    </ul>
  </div>
</template>

<style src="./LanguageSwitcher.css" scoped></style>
