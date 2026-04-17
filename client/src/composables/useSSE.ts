import { ref } from 'vue'
import { useAuth } from './useAuth'

const clientId = ref<string | null>(null)
const isConnected = ref(false)
const events = new EventTarget()

let es: EventSource | null = null

function connect() {
  if (es) return

  es = new EventSource('/api/events')

  es.onopen = () => {
    console.log('[SSE] connection opened')
  }

  es.onmessage = (e) => {
    const data = JSON.parse(e.data)
    console.log(`[SSE] event: ${data.type}`, data)
    if (data.type === 'welcome') {
      clientId.value = data.clientId
      isConnected.value = true
      console.log(`[SSE] assigned clientId: ${data.clientId.slice(0,8)}, locked: ${data.locked}`)
      if (data.locked) {
        events.dispatchEvent(new CustomEvent('locked'))
      } else {
        events.dispatchEvent(new CustomEvent('unlocked'))
      }
    } else {
      events.dispatchEvent(new CustomEvent(data.type, { detail: data }))
    }
  }

  es.onerror = () => {
    console.log(`[SSE] error (readyState: ${es?.readyState})`)
    isConnected.value = false
    if (es?.readyState === EventSource.CLOSED) {
      const { isAuthenticated } = useAuth()
      if (isAuthenticated.value) {
        setTimeout(() => {
          if (isAuthenticated.value) connect()
        }, 3000)
      }
    }
  }
}

function disconnect() {
  if (es) {
    es.close()
    es = null
  }
  isConnected.value = false
}

export function useSSE() {
  return { clientId, isConnected, events, connect, disconnect }
}
