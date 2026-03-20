<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import * as f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'

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
      data: { 'first name': 'Click', 'last name': 'to edit', 'birthday': '', 'avatar': '', gender: 'M' },
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
    .setCardDisplay([['first name', 'last name'], ['birthday']])
    .setMiniTree(true)
    .setStyle('imageCircle')
    .setOnHoverPathToMain()

  f3EditTree = f3Chart.editTree()
    .fixed()
    .setFields(['first name', 'last name', 'birthday', 'avatar'])
    .setEditFirst(false)
    .setCardClickOpen(f3Card)

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
