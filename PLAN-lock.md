# Edit Locking & Live Update Plan

## Overview

Two features to prevent conflicting edits across multiple clients:
1. **Edit locking** — explicit "Edit" button in the header; one person edits at a time
2. **Live update** — when someone saves, other clients auto-reload

Transport: **SSE (Server-Sent Events)** — one-way push (server → client) is all we need. Client → server actions use standard REST.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Server (Bun)                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  In-memory state:                                                    │
│  ┌─────────────────────────────────┐                                │
│  │ clients: Map<clientId, SSE>     │  ← all connected clients       │
│  │ lock: {                         │                                │
│  │   clientId: "uuid",             │  ← current lock holder         │
│  │   lastActivity: timestamp       │    or null if unlocked         │
│  │ }                               │                                │
│  └─────────────────────────────────┘                                │
│                 │                                                    │
│     ┌───────────┼───────────┐                                       │
│     ▼           ▼           ▼                                       │
│  SSE event   SSE event   SSE event                                  │
│  "locked"    "unlocked"  "tree_updated"                             │
│                                                                      │
│  Auto-save (PUT /api/tree) resets lock.lastActivity                 │
│  No heartbeat endpoint needed — saves ARE the heartbeat             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         Client (Vue)                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  AppHeader:                                                          │
│  ┌──────────────────────────────────────────────────┐               │
│  │  Family Tree    [Edit]  [⟳ orientation]          │  ← default    │
│  │  Family Tree    [Done editing]  [⟳]  🔒 banner   │  ← editing    │
│  │  Family Tree    [Edit ✓]  [⟳]  🔒 banner         │  ← locked     │
│  └──────────────────────────────────────────────────┘               │
│                                                                      │
│  SSE "welcome" { locked, clientId }  ──→  set initial lock state    │
│  SSE "locked"                        ──→  show "someone editing"    │
│  SSE "unlocked"                      ──→  enable Edit button        │
│  SSE "tree_updated"                  ──→  refetch + re-init + toast │
│  SSE "lock_expired"                  ──→  toast + exit edit mode    │
│                                                                      │
│  User clicks "Edit"          ──→  POST /api/lock       ──→  200/409 │
│  User clicks "Done editing"  ──→  DELETE /api/lock     ──→  release │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Scope

- ✅ Whole-tree lock (one person edits at a time)
- ✅ Explicit "Edit" / "Done editing" button in AppHeader
- ✅ Lock auto-expires after 15 minutes of no activity
- ✅ Auto-save (PUT /api/tree) resets the 15-min timer — no heartbeat endpoint
- ✅ New clients receive current lock state on connect
- ✅ Auto-reload tree + toast when another client saves
- ✅ Toast when lock acquisition fails (someone else editing)
- ✅ Toast when lock expires while editing
- ✅ All new strings translated (en/de/da)

## Transport: Why SSE, Not WebSocket

- **One-way push only** — server pushes events to clients; client actions are standard REST
- **Simpler** — streaming HTTP response, no protocol upgrade
- **Auto-reconnect** — browser `EventSource` reconnects natively
- **Proxy-friendly** — works through any HTTP proxy without WebSocket-specific config

## Server Changes (`server.ts`)

### New In-Memory State

```typescript
interface ClientEntry {
  id: string
  controller: ReadableStreamDefaultController
}

interface LockState {
  clientId: string
  lastActivity: number
}

let clients: Map<string, ClientEntry> = new Map()
let lock: LockState | null = null
```

### New Endpoints

| Method | Path | Body | Response | Purpose |
|--------|------|------|----------|---------|
| `GET` | `/api/events` | — | SSE stream | Client connects, receives welcome event |
| `POST` | `/api/lock` | `{ clientId }` | `200` or `409` | Acquire edit lock |
| `DELETE` | `/api/lock?clientId=xxx` | — | `200` or `404` | Release edit lock |

### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| `PUT` | `/api/tree` | 1) After saving, update `lock.lastActivity` if requester holds the lock. 2) Broadcast `{ type: "tree_updated" }` to all SSE clients except sender. |

### SSE Events (server → client)

```typescript
// On connect — includes current lock state
{ type: "welcome", clientId: "uuid", locked: boolean }

// Someone acquired the lock
{ type: "locked" }

// Lock released (manual or auto-expired)
{ type: "unlocked" }

// Tree was saved by another client
{ type: "tree_updated" }

// Lock expired while this client held it
{ type: "lock_expired" }
```

### SSE Endpoint Handler

```typescript
function handleEvents(req: Request): Response {
  const clientId = crypto.randomUUID()
  const stream = new ReadableStream({
    start(controller) {
      clients.set(clientId, { id: clientId, controller })
      sendEvent(controller, { type: "welcome", clientId, locked: lock !== null })
    }
  })

  req.signal.addEventListener("abort", () => {
    clients.delete(clientId)
    if (lock && lock.clientId === clientId) {
      lock = null
      broadcast({ type: "unlocked" })
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}
```

### Lock Endpoint Handlers

```typescript
// POST /api/lock
function handleLockAcquire(body: { clientId: string }): Response {
  if (lock && lock.clientId !== body.clientId) return new Response(null, { status: 409 })
  lock = { clientId: body.clientId, lastActivity: Date.now() }
  broadcast({ type: "locked" }, body.clientId)
  return new Response(null, { status: 200 })
}

// DELETE /api/lock?clientId=xxx
function handleLockRelease(clientId: string): Response {
  if (!lock || lock.clientId !== clientId) return new Response(null, { status: 404 })
  lock = null
  broadcast({ type: "unlocked" })
  return new Response(null, { status: 200 })
}
```

### Auto-Expire Interval

```typescript
const LOCK_TIMEOUT = 15 * 60 * 1000 // 15 minutes

setInterval(() => {
  if (lock && Date.now() - lock.lastActivity > LOCK_TIMEOUT) {
    const expiredClientId = lock.clientId
    lock = null
    // Tell the expired client their lock was lost
    sendToClient(expiredClientId, { type: "lock_expired" })
    // Tell everyone else
    broadcast({ type: "unlocked" }, expiredClientId)
  }
}, 30_000)
```

### PUT /api/tree Modification

```typescript
async function handleTreePut(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const senderId = url.searchParams.get("clientId")

  try {
    const data = await req.json()
    const dataStr = JSON.stringify(data)
    db.run("UPDATE family_tree SET data = ?, updated_at = datetime('now') WHERE id = 1", [dataStr])

    // Refresh lock activity if the sender holds it
    if (lock && senderId && lock.clientId === senderId) {
      lock.lastActivity = Date.now()
    }

    // Notify other clients
    broadcast({ type: "tree_updated" }, senderId || undefined)

    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
}
```

### Broadcast & Send Helpers

```typescript
function sendEvent(controller: ReadableStreamDefaultController, event: object) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  controller.enqueue(new TextEncoder().encode(data))
}

function broadcast(event: object, exclude?: string) {
  for (const [id, client] of clients) {
    if (id !== exclude) {
      sendEvent(client.controller, event)
    }
  }
}

function sendToClient(clientId: string, event: object) {
  const client = clients.get(clientId)
  if (client) sendEvent(client.controller, event)
}
```

### Client Cleanup on Disconnect

Handled via `req.signal.addEventListener("abort", ...)` in the SSE handler (see above). Removes the client from `clients` and releases their lock if held.

## Client Changes

### New Files

| File | Purpose |
|------|---------|
| `client/src/composables/useSSE.ts` | SSE connection composable |
| `client/src/composables/useEditLock.ts` | Lock acquire/release logic |
| `client/src/composables/useToast.ts` | Toast queue composable |
| `client/src/components/Toast.vue` | Notification toast |
| `client/src/components/Toast.css` | Toast styles |

### `useSSE.ts` — SSE Connection Composable

Singleton composable. Connects on first use, reconnects automatically via `EventSource`.

```typescript
import { ref } from 'vue'

const clientId = ref<string | null>(null)
const isConnected = ref(false)
const events = new EventTarget()

let es: EventSource | null = null

function connect() {
  if (es) return

  es = new EventSource('/api/events')

  es.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.type === 'welcome') {
      clientId.value = data.clientId
      isConnected.value = true
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
    isConnected.value = false
    // EventSource auto-reconnects; on success, welcome event resets state
  }
}

export function useSSE() {
  return { clientId, isConnected, events, connect }
}
```

### `useEditLock.ts` — Lock Management Composable

```typescript
import { ref } from 'vue'
import { useSSE } from './useSSE'

const isLockedByOther = ref(false)
const isEditing = ref(false)

async function acquireLock(): Promise<boolean> {
  const { clientId } = useSSE()
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
  isEditing.value = false
  await fetch(`/api/lock?clientId=${clientId.value}`, {
    method: 'DELETE',
  })
}

export function useEditLock() {
  return { isLockedByOther, isEditing, acquireLock, releaseLock }
}
```

### `useToast.ts` — Toast Queue Composable

```typescript
import { ref } from 'vue'

interface Toast {
  id: number
  message: string
}

const toasts = ref<Toast[]>([])
let nextId = 0

function showToast(message: string, duration = 3000) {
  const id = nextId++
  toasts.value.push({ id, message })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

export function useToast() {
  return { toasts, showToast }
}
```

### `AppHeader.vue` Changes

Add an Edit/Done editing button next to the orientation toggle.

```html
<template>
  <header class="app-header">
    <h1>{{ title }}</h1>
    <div class="app-header-actions">
      <button
        v-if="!isEditing"
        class="btn-edit"
        :disabled="isLockedByOther"
        @click="handleEditClick"
      >
        {{ isLockedByOther ? t('ui.someoneEditing') : t('ui.edit') }}
      </button>
      <button
        v-else
        class="btn-done"
        @click="handleDoneClick"
      >
        {{ t('ui.doneEditing') }}
      </button>
      <button class="btn-orientation" @click="$emit('toggle-orientation')">
        {{ isVertical ? '↔' : '↕' }}
      </button>
    </div>
  </header>
</template>
```

```typescript
// Script additions
const { isLockedByOther, isEditing, acquireLock, releaseLock } = useEditLock()
const { showToast } = useToast()

async function handleEditClick() {
  const ok = await acquireLock()
  if (!ok) {
    showToast(t('ui.lockedByOther'))
  }
}

async function handleDoneClick() {
  await releaseLock()
}
```

### `FamilyChart.vue` Changes

**SSE event listeners (in onMounted, after connect):**
```typescript
const { events, connect, clientId } = useSSE()
const { isLockedByOther, isEditing } = useEditLock()
const { showToast } = useToast()

onMounted(async () => {
  connect()

  events.addEventListener('locked', () => {
    isLockedByOther.value = true
  })

  events.addEventListener('unlocked', () => {
    isLockedByOther.value = false
  })

  events.addEventListener('lock_expired', () => {
    isEditing.value = false
    isLockedByOther.value = false
    showToast(t('ui.lockExpired'))
  })

  events.addEventListener('tree_updated', () => {
    if (isEditing.value) return // don't reload while editing
    fetchTree().then(data => {
      currentData = data
      initChart(data)
      showToast(t('ui.treeUpdated'))
    })
  })

  // ... existing fetchTree + initChart logic
})
```

**Modified saveTree — include clientId for lock activity refresh:**
```typescript
async function saveTree(data: f3.Data): Promise<void> {
  await fetch(`/api/tree?clientId=${clientId.value}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
```

**Guard card clicks when locked by someone else:**
```typescript
// When isLockedByOther is true, the chart is in read-only mode.
// Disable f3's card click handler by not calling setCardClickOpen.
// In initChart, conditionally set up editing:
if (isEditing.value) {
  f3EditTree = f3Chart.editTree()
    .fixed()
    .setFields(getI18nFields())
    // ... full edit setup
} else {
  // Read-only: no editTree, no card click handler
}
```

When `isEditing` changes (user clicks Edit or Done), re-initialize the chart via `watch`:
```typescript
watch(isEditing, () => {
  initChart(currentData)
})
```

### `Toast.vue` — Notification Component

```
┌─────────────────────────┐
│  Tree updated           │  ← slides up from bottom, auto-dismisses 3s
└─────────────────────────┘
```

- Positioned fixed at bottom center
- Slides up with CSS transition
- Auto-dismisses after 3 seconds
- Supports multiple queued toasts (stacks vertically)

```html
<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" class="toast">
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'
const { toasts } = useToast()
</script>
```

## New Translation Keys

**en.json additions:**
```json
{
  "ui": {
    "edit": "Edit",
    "doneEditing": "Done editing",
    "lockedByOther": "Someone else is currently editing. Try again later.",
    "someoneEditing": "Someone is editing",
    "treeUpdated": "Tree updated",
    "lockExpired": "Your edit session expired. Click Edit to continue."
  }
}
```

**de.json additions:**
```json
{
  "ui": {
    "edit": "Bearbeiten",
    "doneEditing": "Fertig",
    "lockedByOther": "Jemand anderes bearbeitet gerade. Versuche es später erneut.",
    "someoneEditing": "Jemand bearbeitet",
    "treeUpdated": "Stammbaum aktualisiert",
    "lockExpired": "Bearbeitungssitzung abgelaufen. Klicke auf Bearbeiten zum Fortfahren."
  }
}
```

**da.json additions:**
```json
{
  "ui": {
    "edit": "Rediger",
    "doneEditing": "Færdig",
    "lockedByOther": "En anden redigerer lige nu. Prøv igen senere.",
    "someoneEditing": "Nogen redigerer",
    "treeUpdated": "Slægtstræ opdateret",
    "lockExpired": "Redigering udløbet. Klik på Rediger for at fortsætte."
  }
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `server.ts` | Modify | Add SSE endpoint, lock endpoints, broadcast, auto-expire, modify PUT /api/tree |
| `client/src/composables/useSSE.ts` | Create | SSE connection composable |
| `client/src/composables/useEditLock.ts` | Create | Lock acquire/release logic |
| `client/src/composables/useToast.ts` | Create | Toast queue composable |
| `client/src/components/AppHeader.vue` | Modify | Add Edit/Done editing button |
| `client/src/components/AppHeader.css` | Modify | Button styles + disabled state |
| `client/src/components/FamilyChart.vue` | Modify | Integrate SSE listeners, conditional edit mode, guard saves |
| `client/src/components/FamilyChart.css` | Modify | Lock banner styles (if needed) |
| `client/src/components/Toast.vue` | Create | Notification toast component |
| `client/src/components/Toast.css` | Create | Toast styles |
| `client/src/App.vue` | Modify | Mount Toast component globally, pass lock state to AppHeader |
| `client/src/i18n/locales/en.json` | Modify | Add lock/toast translation keys |
| `client/src/i18n/locales/de.json` | Modify | Add lock/toast translation keys |
| `client/src/i18n/locales/da.json` | Modify | Add lock/toast translation keys |

## Execution Order

1. Add SSE + lock endpoints + auto-expire + modify PUT /api/tree in `server.ts`
2. Create `useToast.ts` composable
3. Create `useSSE.ts` composable
4. Create `useEditLock.ts` composable
5. Add new translation keys to all three locale files
6. Create `Toast.vue` + `Toast.css`
7. Mount Toast in `App.vue`
8. Update `AppHeader.vue` + `AppHeader.css` — add Edit/Done button
9. Update `FamilyChart.vue` — integrate SSE listeners, conditional edit mode, guarded saveTree
10. Build & test: `cd client && bun run build`

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Client disconnects while holding lock | `req.signal` abort handler releases lock |
| Lock expires (15 min no saves) | Server sends `lock_expired` to holder, `unlocked` to others |
| SSE reconnects after drop | Welcome event re-syncs lock state; client gets new `clientId` |
| Two users click Edit simultaneously | First `POST /api/lock` wins; second gets 409 + toast |
| Tree updated while user is editing | `tree_updated` is ignored by the editing client |
| Browser tab backgrounded on mobile | Auto-saves still fire on field changes, keeping lock alive |
| Server restarts | All in-memory state lost; clients reconnect and get fresh `welcome` |
