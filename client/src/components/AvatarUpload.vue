<script setup lang="ts">
import { ref, computed } from 'vue'
import AvatarCropper from './AvatarCropper.vue'

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
    
    const response = await fetch(`/api/images/${props.personId}`, {
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
    alert('Upload fehlgeschlagen. Bitte versuche es erneut.')
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
        <span>Foto ändern</span>
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

<style scoped>
.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar-preview {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  background: #f0f0f0;
  border: 2px solid #ddd;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.placeholder-icon {
  font-size: 40px;
}

.avatar-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  text-align: center;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-preview:hover .avatar-overlay {
  opacity: 1;
}

.avatar-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ddd;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.file-input {
  display: none;
}
</style>
