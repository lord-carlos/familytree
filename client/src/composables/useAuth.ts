import { ref } from 'vue'

const isAuthenticated = ref(false)
const isChecking = ref(true)

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options)
  if (res.status === 401) {
    isAuthenticated.value = false
  }
  return res
}

async function checkAuth(): Promise<void> {
  isChecking.value = true
  try {
    const res = await fetch('/api/auth/check')
    isAuthenticated.value = res.ok
  } catch {
    isAuthenticated.value = false
  } finally {
    isChecking.value = false
  }
}

async function login(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      isAuthenticated.value = true
      return { success: true }
    }
    return { success: false, error: 'Wrong password' }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
  isAuthenticated.value = false
}

export function useAuth() {
  return { isAuthenticated, isChecking, checkAuth, login, logout, apiFetch }
}
