import { ref } from 'vue'
import { useSSE } from './useSSE'
import { useAuth } from './useAuth'

const isLockedByOther = ref(false)
const isEditing = ref(false)

async function acquireLock(): Promise<boolean> {
  const { clientId } = useSSE()
  const { apiFetch } = useAuth()
  if (!clientId.value) return false
  const res = await apiFetch('/api/lock', {
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
  const { apiFetch } = useAuth()
  const res = await apiFetch(`/api/lock?clientId=${clientId.value}`, {
    method: 'DELETE',
  })
  if (res.ok) {
    isEditing.value = false
  }
}

export function useEditLock() {
  return { isLockedByOther, isEditing, acquireLock, releaseLock }
}
