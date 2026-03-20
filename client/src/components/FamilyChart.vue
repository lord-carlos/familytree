<script setup lang="ts">
import { onMounted, onUnmounted, createApp, h } from 'vue'
import * as f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import AvatarUpload from './AvatarUpload.vue'

type ChartType = ReturnType<typeof f3.createChart>
type EditTreeType = ReturnType<ChartType['editTree']>

let f3Chart: ChartType | null = null
let f3EditTree: EditTreeType | null = null

async function fetchTree(): Promise<f3.Data> {
  const res = await fetch('/api/tree')
  if (!res.ok) throw new Error('Failed to fetch tree')
  return res.json()
}

async function saveTree(data: f3.Data): Promise<void> {
  await fetch('/api/tree', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

onMounted(async () => {
  let data = await fetchTree()

  if (data.length === 0) {
    data = [{
      id: '0',
      data: { 'first name': 'Click', 'last name': 'to edit', 'birthday': '', 'death date': '', 'avatar': '', gender: 'M' },
      rels: { parents: [], spouses: [], children: [] }
    }] as f3.Data
  }

  f3Chart = f3.createChart('#FamilyChart', data)
    .setTransitionTime(1000)
    .setCardXSpacing(200)
    .setCardYSpacing(150)
    .setSingleParentEmptyCard(true, { label: 'Hinzufügen' })
    .setShowSiblingsOfMain(true)
    .setOrientationVertical()
    .setAncestryDepth(100)
    .setProgenyDepth(100)

  const f3Card = f3Chart.setCardHtml()
    .setCardDisplay([['first name', 'last name'], ['birthday'], ['death date']])
    .setMiniTree(true)
    .setStyle('imageCircle')
    .setOnHoverPathToMain()

type FormCreatorWithDatumId = { datum_id: string }

  f3EditTree = f3Chart.editTree()
    .fixed()
    .setFields(['first name', 'last name', 'birthday', 'death date', 'avatar'])
    .setEditFirst(false)
    .setCardClickOpen(f3Card)
    .setOnFormCreation(({ cont, form_creator }: { cont: HTMLElement; form_creator: FormCreatorWithDatumId }) => {
      const form = cont.tagName === 'FORM' ? cont : cont.querySelector('form')
      const isEditable = form ? !form.classList.contains('non-editable') : true
      const personId = form_creator.datum_id
      
      const avatarField = cont.querySelector('[name="avatar"]') as HTMLInputElement
      
      if (isEditable && avatarField && !avatarField.dataset.avatarUploadAdded) {
        avatarField.dataset.avatarUploadAdded = 'true'
        const fieldParent = avatarField.closest('.f3-form-field') || avatarField.parentElement
        if (fieldParent) {
          (fieldParent as HTMLElement).style.display = 'none'
          const avatarContainer = document.createElement('div')
          avatarContainer.className = 'f3_avatar_upload'
          avatarContainer.style.cssText = 'display:flex;justify-content:center;padding:12px 0;'
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
        }
      } else if (!isEditable) {
        const allFields = cont.querySelectorAll('.f3-info-field')
        allFields.forEach((field) => {
          const label = field.querySelector('.f3-info-field-label')
          if (label && label.textContent?.toLowerCase().includes('avatar')) {
            const valueEl = field.querySelector('.f3-info-field-value') as HTMLElement | null
            if (valueEl && !field.querySelector('.f3_avatar_display')) {
              const avatarUrl = valueEl.textContent?.trim() || ''
              if (avatarUrl) {
                valueEl.style.display = 'none'
                const img = document.createElement('img')
                img.className = 'f3_avatar_display'
                img.src = avatarUrl.replace('_thumb.webp', '_full.webp')
                img.style.cssText = 'width:100px;height:100px;border-radius:50%;object-fit:cover;margin:8px auto;display:block;'
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
          wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;position:relative'
          field.parentNode?.insertBefore(wrapper, field)
          wrapper.appendChild(field)

          const dateInput = document.createElement('input')
          dateInput.type = 'date'
          dateInput.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0'
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
          btn.className = 'date-picker-btn'
          btn.textContent = '📅'
          btn.style.cssText = 'width:40px;height:40px;padding:0;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1'
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
      saveTree(updatedData as f3.Data)
    }
  })

  f3EditTree!.setEdit()

  f3Chart.updateTree({ initial: true })
})

onUnmounted(() => {
  f3EditTree?.destroy()
})
</script>

<template>
  <div id="FamilyChart" class="f3" style="width:100%;height:100vh;"></div>
</template>
