<script setup lang="ts">
import { ref, computed } from 'vue'
import AvatarCropper from './AvatarCropper.vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'

const { t } = useI18n()
const { apiFetch } = useAuth()

const props = defineProps<{
  personId: string
  currentAvatar?: string
}>()

const emit = defineEmits<{
  (e: 'update:avatar', url: string): void
}>()

const showCropper = ref(false)
const imageSrc = ref('')
const isUploading = ref(false)
const localPreviewUrl = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const avatarUrl = computed(() => {
  if (localPreviewUrl.value) return localPreviewUrl.value
  if (!props.currentAvatar) return ''
  return props.currentAvatar
})

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    imageSrc.value = e.target?.result as string
    showCropper.value = true
  }
  reader.readAsDataURL(file)
  
  input.value = ''
}

async function handleCropConfirm(payload: { thumbnail: Blob; full: Blob }) {
  showCropper.value = false
  
  localPreviewUrl.value = URL.createObjectURL(payload.thumbnail)
  isUploading.value = true
  
  try {
    const formData = new FormData()
    formData.append('thumbnail', payload.thumbnail, 'thumbnail.webp')
    formData.append('full', payload.full, 'full.webp')
    
    const response = await apiFetch(`/api/images/${props.personId}`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) throw new Error('Upload failed')
    
    const data = await response.json()
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = data.thumbnailUrl
    emit('update:avatar', data.thumbnailUrl)
  } catch (error) {
    console.error('Upload error:', error)
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = ''
    alert(t('ui.uploadFailed'))
  } finally {
    isUploading.value = false
  }
}

function handleCropCancel() {
  showCropper.value = false
  imageSrc.value = ''
}
</script>

<template>
  <div class="avatar-upload">
    <div class="avatar-preview" @click="triggerFilePicker">
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        alt="Avatar"
        class="avatar-image"
      />
      <div v-else class="avatar-placeholder">
        <span class="placeholder-icon">👤</span>
      </div>
      <div v-if="isUploading" class="avatar-loading-overlay">
        <div class="spinner"></div>
      </div>
      <div class="avatar-overlay">
        <span>{{ t('ui.changePhoto') }}</span>
      </div>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="file-input"
      @change="handleFileSelect"
    />
    
    <Teleport to="body">
      <AvatarCropper
        v-if="showCropper"
        :image-src="imageSrc"
        @confirm="handleCropConfirm"
        @cancel="handleCropCancel"
      />
    </Teleport>
  </div>
</template>

<style src="./AvatarUpload.css" scoped></style>
