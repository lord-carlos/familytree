<script setup lang="ts">
import LanguageSwitcher from './LanguageSwitcher.vue'
import { useEditLock } from '../composables/useEditLock'
import { useSSE } from '../composables/useSSE'
import { useToast } from '../composables/useToast'
import { useI18n } from '../i18n'

defineEmits<{ 'toggle-orientation': [] }>()
defineProps<{ title: string }>()

const { isLockedByOther, isEditing, acquireLock, releaseLock } = useEditLock()
const { isConnected } = useSSE()
const { showToast } = useToast()
const { t } = useI18n()

async function handleEditClick() {
  const ok = await acquireLock()
  if (!ok) {
    showToast(t('ui.lockedByOther'))
  }
}

async function handleDoneClick() {
  await releaseLock()
}
</script>

<template>
  <header class="app-header">
    <span class="title">{{ title }}</span>
    <div class="header-actions">
      <button
        v-if="!isEditing"
        class="btn-edit"
        :disabled="isLockedByOther || !isConnected"
        @click="handleEditClick"
      >
        {{ isLockedByOther ? t('ui.someoneEditing') : t('ui.edit') }}
      </button>
      <button
        v-else
        class="btn-done"
        @click="handleDoneClick"
      >
        {{ t('ui.doneEditing') }}
      </button>
      <LanguageSwitcher />
      <button class="toggle-btn" @click="$emit('toggle-orientation')" title="Toggle orientation">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style src="./AppHeader.css" scoped></style>
