<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const { login } = useAuth()
const { t } = useI18n()

const password = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  error.value = ''
  isLoading.value = true
  const result = await login(password.value)
  isLoading.value = false
  if (!result.success) {
    error.value = result.error === 'Wrong password' ? t('auth.wrongPassword') : result.error || 'Error'
    password.value = ''
  }
}
</script>

<template>
  <div class="login-screen">
    <div class="login-card">
      <h1 class="login-title">{{ t('auth.title') }}</h1>
      <form class="login-form" @submit.prevent="handleSubmit">
        <input
          v-model="password"
          type="password"
          class="login-input"
          :placeholder="t('auth.password')"
          autocomplete="current-password"
          autofocus
        />
        <button type="submit" class="login-button" :disabled="isLoading || !password">
          {{ isLoading ? t('auth.loading') : t('auth.submit') }}
        </button>
      </form>
      <p v-if="error" class="login-error">{{ error }}</p>
    </div>
  </div>
</template>

<style src="./Login.css" scoped></style>
