<script setup lang="ts">
import { ref } from 'vue'
import { Cropper, CircleStencil } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const props = defineProps<{
  imageSrc: string
}>()

const emit = defineEmits<{
  (e: 'confirm', payload: { thumbnail: Blob; full: Blob }): void
  (e: 'cancel'): void
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

function handleConfirm() {
  if (!cropperRef.value) return
  
  const { canvas } = cropperRef.value.getResult()
  if (!canvas) return
  
  const thumbnailCanvas = document.createElement('canvas')
  thumbnailCanvas.width = 100
  thumbnailCanvas.height = 100
  const thumbCtx = thumbnailCanvas.getContext('2d')
  if (!thumbCtx) return
  thumbCtx.drawImage(canvas, 0, 0, 100, 100)
  
  const fullCanvas = document.createElement('canvas')
  fullCanvas.width = 400
  fullCanvas.height = 400
  const fullCtx = fullCanvas.getContext('2d')
  if (!fullCtx) return
  fullCtx.drawImage(canvas, 0, 0, 400, 400)
  
  thumbnailCanvas.toBlob((thumbnailBlob) => {
    if (!thumbnailBlob) return
    fullCanvas.toBlob((fullBlob) => {
      if (!fullBlob) return
      emit('confirm', { thumbnail: thumbnailBlob, full: fullBlob })
    }, 'image/webp', 0.9)
  }, 'image/webp', 0.9)
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <div class="cropper-overlay">
    <div class="cropper-container">
      <div class="cropper-header">
        <button class="btn-cancel" @click="handleCancel">Abbrechen</button>
        <span class="title">Avatar zuschneiden</span>
        <button class="btn-confirm" @click="handleConfirm">Fertig</button>
      </div>
      <div class="cropper-body">
        <Cropper
          ref="cropperRef"
          :src="imageSrc"
          :stencil-component="CircleStencil"
          class="cropper"
        />
      </div>
      <div class="cropper-hint">
        Pinch zum Zoomen, ziehen zum Verschieben
      </div>
    </div>
  </div>
</template>

<style src="./AvatarCropper.css" scoped></style>
