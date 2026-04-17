import { ref } from 'vue'
import { useSSE } from './useSSE'

const isLockedByOther = ref(false)
const isEditing = ref(false)

async function acquireLock(): Promise<boolean> {
  const { clientId } = useSSE()
  if (!clientId.value) return false
  const res = await fetch('/api/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: clientId.value }),
  })
  if (res.ok) {
    isEditing.value = true
    return true
  }
  return false
}

async function releaseLock() {
  const { clientId } = useSSE()
  const res = await fetch(`/api/lock?clientId=${clientId.value}`, {
    method: 'DELETE',
  })
  if (res.ok) {
    isEditing.value = false
  }
}

export function useEditLock() {
  return { isLockedByOther, isEditing, acquireLock, releaseLock }
}
