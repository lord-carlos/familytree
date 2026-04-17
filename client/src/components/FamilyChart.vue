<script setup lang="ts">
import { onMounted, onUnmounted, createApp, h, ref, watch } from 'vue'
import * as f3 from 'family-chart'
import './FamilyChart.css'
import AvatarUpload from './AvatarUpload.vue'
import { useI18n } from '../i18n'
import { useSSE } from '../composables/useSSE'
import { useEditLock } from '../composables/useEditLock'
import { useToast } from '../composables/useToast'

type ChartType = ReturnType<typeof f3.createChart>
type EditTreeType = ReturnType<ChartType['editTree']>
type FormCreatorWithDatumId = { datum_id: string }

let f3Chart: ChartType | null = null
let f3EditTree: EditTreeType | null = null
const mountedAvatarApps: ReturnType<typeof createApp>[] = []
let currentData: f3.Data = []

const { t, localeRef } = useI18n()
const { events, connect, clientId } = useSSE()
const { isLockedByOther, isEditing } = useEditLock()
const { showToast } = useToast()

const isVertical = ref(localStorage.getItem('orientation') !== 'horizontal')

function toggleOrientation() {
  isVertical.value = !isVertical.value
  localStorage.setItem('orientation', isVertical.value ? 'vertical' : 'horizontal')
  if (isVertical.value) {
    f3Chart?.setOrientationVertical()
  } else {
    f3Chart?.setOrientationHorizontal()
  }
  f3Chart?.updateTree()
}

defineExpose({ toggleOrientation })

async function fetchTree(): Promise<f3.Data> {
  const res = await fetch('/api/tree')
  if (!res.ok) throw new Error('Failed to fetch tree')
  return res.json()
}

async function saveTree(data: f3.Data): Promise<void> {
  await fetch(`/api/tree?clientId=${clientId.value}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

function getI18nFields() {
  return [
    { type: 'text' as const, id: 'first name', label: t('fields.first name') },
    { type: 'text' as const, id: 'last name', label: t('fields.last name') },
    { type: 'text' as const, id: 'birthday', label: t('fields.birthday') },
    { type: 'text' as const, id: 'death date', label: t('fields.death date') },
    { type: 'text' as const, id: 'avatar', label: t('fields.avatar') },
  ]
}

function initChart(data: f3.Data) {
  destroyChart()

  f3Chart = f3.createChart('#FamilyChart', data)
    .setTransitionTime(1000)
    .setCardXSpacing(160)
    .setCardYSpacing(150)
    .setSingleParentEmptyCard(true, { label: t('ui.addPerson') })
    .setShowSiblingsOfMain(true)
    .setAncestryDepth(100)
    .setProgenyDepth(100)

  if (isVertical.value) {
    f3Chart.setOrientationVertical()
  } else {
    f3Chart.setOrientationHorizontal()
  }

  const f3Card = f3Chart.setCardHtml()
    .setCardDisplay([['first name', 'last name'], ['birthday'], ['death date']])
    .setMiniTree(true)
    .setStyle('imageCircle')
    .setOnHoverPathToMain()

  if (isEditing.value) {
    f3EditTree = f3Chart.editTree()
      .fixed()
      .setFields(getI18nFields())
      .setEditFirst(false)
      .setCardClickOpen(f3Card)
      .setOnFormCreation(({ cont, form_creator }: { cont: HTMLElement; form_creator: FormCreatorWithDatumId }) => {
        const form = cont.tagName === 'FORM' ? cont : cont.querySelector('form')
        const isFieldEditable = form ? !form.classList.contains('non-editable') : true
        const personId = form_creator.datum_id

        const avatarField = cont.querySelector('[name="avatar"]') as HTMLInputElement

        if (isFieldEditable && avatarField && !avatarField.dataset.avatarUploadAdded) {
          avatarField.dataset.avatarUploadAdded = 'true'
          const fieldParent = avatarField.closest('.f3-form-field') || avatarField.parentElement
          if (fieldParent) {
            fieldParent.classList.add('hidden')
            const avatarContainer = document.createElement('div')
            avatarContainer.className = 'f3-avatar-upload'
            fieldParent.parentNode?.insertBefore(avatarContainer, fieldParent.nextSibling)

            const currentAvatar = avatarField.value || ''

            const avatarApp = createApp({
              render: () => h(AvatarUpload, {
                personId: personId,
                currentAvatar: currentAvatar,
                'onUpdate:avatar': (url: string) => {
                  avatarField.value = url
                  avatarField.dispatchEvent(new Event('input', { bubbles: true }))
                }
              })
            })
            avatarApp.mount(avatarContainer)
            mountedAvatarApps.push(avatarApp)
          }
        } else if (!isFieldEditable) {
          const allFields = cont.querySelectorAll('.f3-info-field')
          allFields.forEach((field) => {
            const inputEl = field.querySelector('input[name="avatar"]')
            if (inputEl) {
              const valueEl = field.querySelector('.f3-info-field-value') as HTMLElement | null
              if (valueEl && !field.querySelector('.f3_avatar_display')) {
                const avatarUrl = valueEl.textContent?.trim() || ''
                if (avatarUrl) {
                  valueEl.classList.add('hidden')
                  const img = document.createElement('img')
                  img.className = 'f3-avatar-display'
                  img.src = avatarUrl.replace('_thumb.webp', '_full.webp')
                  field.appendChild(img)
                }
              }
            }
          })
        }
        const addDatePicker = (fieldName: string) => {
          const field = cont.querySelector(`[name="${fieldName}"]`) as HTMLInputElement
          if (field && !field.dataset.datePickerAdded) {
            field.dataset.datePickerAdded = 'true'
            const wrapper = document.createElement('div')
            wrapper.className = 'f3-date-wrapper'
            field.parentNode?.insertBefore(wrapper, field)
            wrapper.appendChild(field)

            const dateInput = document.createElement('input')
            dateInput.type = 'date'
            dateInput.className = 'f3-date-input-hidden'
            dateInput.value = field.value || ''
            dateInput.addEventListener('change', () => {
              field.value = dateInput.value
              field.dispatchEvent(new Event('input', { bubbles: true }))
            })
            field.addEventListener('input', () => {
              dateInput.value = field.value || ''
            })
            wrapper.appendChild(dateInput)

            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'f3-date-picker-btn'
            btn.textContent = '📅'
            btn.addEventListener('click', () => {
              if (dateInput.showPicker) {
                dateInput.showPicker()
              } else {
                dateInput.click()
              }
            })
            wrapper.appendChild(btn)
          }
        }
        addDatePicker('birthday')
        addDatePicker('death date')
      })

    ;(f3EditTree as unknown as { setOnChange: (fn: () => void) => void }).setOnChange(() => {
      const updatedData = f3EditTree?.exportData()
      if (updatedData) {
        currentData = updatedData as f3.Data
        saveTree(currentData)
      }
    })

    f3EditTree!.setEdit()
  }

  f3Chart.updateTree({ initial: true })
}

function destroyChart() {
  mountedAvatarApps.forEach(app => app.unmount())
  mountedAvatarApps.length = 0
  f3EditTree?.destroy()
  f3EditTree = null
  f3Chart = null
  const container = document.querySelector('#FamilyChart')
  if (container) container.innerHTML = ''
}

const eventHandlers: Array<{ event: string; handler: EventListener }> = []

function addSSEListener(event: string, handler: EventListener) {
  events.addEventListener(event, handler)
  eventHandlers.push({ event, handler })
}

onMounted(async () => {
  connect()

  addSSEListener('locked', () => {
    isLockedByOther.value = true
  })

  addSSEListener('unlocked', () => {
    isLockedByOther.value = false
  })

  addSSEListener('lock_expired', () => {
    isEditing.value = false
    isLockedByOther.value = false
    showToast(t('ui.lockExpired'))
  })

  addSSEListener('tree_updated', () => {
    if (isEditing.value) return
    fetchTree().then(data => {
      currentData = data
      initChart(data)
      showToast(t('ui.treeUpdated'))
    })
  })

  let data = await fetchTree()

  if (data.length === 0) {
    data = [{
      id: '0',
      data: { 'first name': t('ui.click'), 'last name': t('ui.toEdit'), 'birthday': '', 'death date': '', 'avatar': '', gender: 'M' },
      rels: { parents: [], spouses: [], children: [] }
    }] as f3.Data
  }

  currentData = data
  initChart(data)
})

watch(localeRef, () => {
  initChart(currentData)
})

watch(isEditing, () => {
  initChart(currentData)
})

onUnmounted(() => {
  for (const { event, handler } of eventHandlers) {
    events.removeEventListener(event, handler)
  }
  eventHandlers.length = 0
  destroyChart()
})
</script>

<template>
  <div id="FamilyChart" class="f3"></div>
</template>
