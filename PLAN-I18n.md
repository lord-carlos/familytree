# i18n Implementation Plan

## Overview

family-chart's `setFields()` supports objects with separate `id` and `label`:
- `id` — used for data access (`datum.data[id]`) and `<input name="id">`
- `label` — used for `<label>` display text

This means we pass translated labels via `label` while `id` stays matched to the existing DB keys. No data transformation needed.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Data Flow                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Database (SQLite) — keys never change                               │
│  ┌─────────────────────────────────┐                                │
│  │ { "first name": "John",         │  ← Existing keys (stable)      │
│  │   "last name": "Doe",           │                                 │
│  │   "birthday": "1980-01-15",     │                                 │
│  │   "death date": null }          │                                 │
│  └─────────────────────────────────┘                                │
│                 │                                                    │
│                 ▼                                                    │
│  family-chart setFields() — uses object fields                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ .setFields([                                                  │   │
│  │   { id: "first name", label: "Vorname",  type: "text" },     │   │
│  │   { id: "last name",  label: "Nachname", type: "text" },     │   │
│  │   ...                                                         │   │
│  │ ])                                                            │   │
│  │                                                               │   │
│  │  id    → datum.data["first name"] (reads/writes DB key)      │   │
│  │  label → <label>Vorname</label>   (display only)             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                 │                                                    │
│                 ▼ (on save)                                          │
│  Data saved directly — no reverse transform needed                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Scope

- ✅ Field labels (via `setFields` object `{ id, label }`)
- ✅ UI strings ("Add", "Click to edit", avatar/cropper strings)
- ✅ Browser language detection with EN fallback
- ✅ Language preference stored in localStorage
- ✅ Language switching re-initializes the chart

## File Structure

```
client/src/
├── i18n/
│   ├── index.ts              # i18n composable (useI18n)
│   └── locales/
│       ├── en.json           # English translations
│       ├── de.json           # German translations
│       └── da.json           # Danish translations
└── components/
    ├── FamilyChart.vue       # Updated to use i18n fields + labels
    ├── LanguageSwitcher.vue  # Language selector component
    ├── LanguageSwitcher.css  # Language selector styles
    ├── AvatarUpload.vue      # Updated hardcoded strings
    └── AvatarCropper.vue     # Updated hardcoded strings
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `client/src/i18n/index.ts` | Create | i18n composable with reactive locale |
| `client/src/i18n/locales/en.json` | Create | English translations |
| `client/src/i18n/locales/de.json` | Create | German translations |
| `client/src/i18n/locales/da.json` | Create | Danish translations |
| `client/src/components/FamilyChart.vue` | Modify | Use i18n fields + translated labels |
| `client/src/components/LanguageSwitcher.vue` | Create | Language selector UI component |
| `client/src/components/LanguageSwitcher.css` | Create | Language selector styles |
| `client/src/components/AvatarUpload.vue` | Modify | Replace hardcoded German strings |
| `client/src/components/AvatarCropper.vue` | Modify | Replace hardcoded German strings |
| `client/src/components/AppHeader.vue` | Modify | Add LanguageSwitcher component |

## Implementation Details

### 1. DB Keys (existing, unchanged)

```typescript
// These are the keys already stored in the database — they stay as-is
const FIELD_IDS = {
  firstName: 'first name',
  lastName: 'last name',
  birthDate: 'birthday',
  deathDate: 'death date',
  avatar: 'avatar',
} as const
```

### 2. Locale Files

**en.json:**
```json
{
  "fields": {
    "first name": "First name",
    "last name": "Last name",
    "birthday": "Birthday",
    "death date": "Death date",
    "avatar": "Avatar"
  },
  "ui": {
    "addPerson": "Add",
    "clickToEdit": "Click to edit",
    "uploadFailed": "Upload failed. Please try again.",
    "changePhoto": "Change photo",
    "cancel": "Cancel",
    "cropAvatar": "Crop avatar",
    "done": "Done",
    "cropHint": "Pinch to zoom, drag to move"
  }
}
```

**de.json:**
```json
{
  "fields": {
    "first name": "Vorname",
    "last name": "Nachname",
    "birthday": "Geburtsdatum",
    "death date": "Sterbedatum",
    "avatar": "Profilbild"
  },
  "ui": {
    "addPerson": "Hinzufügen",
    "clickToEdit": "Klicken zum Bearbeiten",
    "uploadFailed": "Upload fehlgeschlagen. Bitte versuche es erneut.",
    "changePhoto": "Foto ändern",
    "cancel": "Abbrechen",
    "cropAvatar": "Avatar zuschneiden",
    "done": "Fertig",
    "cropHint": "Pinch zum Zoomen, ziehen zum Verschieben"
  }
}
```

**da.json:**
```json
{
  "fields": {
    "first name": "Fornavn",
    "last name": "Efternavn",
    "birthday": "Fødselsdag",
    "death date": "Dødsdato",
    "avatar": "Profilbillede"
  },
  "ui": {
    "addPerson": "Tilføj",
    "clickToEdit": "Klik for at redigere",
    "uploadFailed": "Upload mislykkedes. Prøv igen.",
    "changePhoto": "Skift billede",
    "cancel": "Annuller",
    "cropAvatar": "Beskær avatar",
    "done": "Færdig",
    "cropHint": "Klem for at zoome, træk for at flytte"
  }
}
```

### 3. Language Detection (priority order)

```
1. localStorage.getItem('locale')  ← user's explicit choice
2. navigator.language              ← browser setting (e.g., "de-DE" → "de")
3. 'en'                            ← fallback
```

### 4. i18n Composable

```typescript
// i18n/index.ts — Pseudocode

// Reactive locale ref
const locale = ref(loadLocale())

// Translation function
function t(key: string): string {
  return messages[locale.value]?.[key] ?? fallback[key] ?? key
}

// Watch locale changes → re-initialize chart
function setLocale(newLocale: string) {
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
  // Chart re-init handled by FamilyChart.vue watching locale
}

export function useI18n() {
  return { locale, t, setLocale, supportedLocales }
}
```

### 5. FamilyChart.vue Changes

**a) `setFields()` — use object fields with translated labels:**
```typescript
// Before:
.setFields(['first name', 'last name', 'birthday', 'death date', 'avatar'])

// After:
.setFields([
  { type: 'text', id: 'first name', label: t('fields.first name') },
  { type: 'text', id: 'last name',  label: t('fields.last name') },
  { type: 'text', id: 'birthday',   label: t('fields.birthday') },
  { type: 'text', id: 'death date', label: t('fields.death date') },
  { type: 'text', id: 'avatar',     label: t('fields.avatar') },
])
```

**b) `setCardDisplay()` — unchanged** (still uses `'first name'`, `'last name'` etc. as data keys).

**c) `setSingleParentEmptyCard()` — use translated label:**
```typescript
// Before:
.setSingleParentEmptyCard(true, { label: 'Hinzufügen' })

// After:
.setSingleParentEmptyCard(true, { label: t('ui.addPerson') })
```

**d) Default person text — use translated strings:**
```typescript
// Before:
data: { 'first name': 'Click', 'last name': 'to edit', ... }

// After:
data: { 'first name': t('ui.clickToEdit').split(' ')[0],
        'last name': t('ui.clickToEdit').split(' ')[1], ... }
// Or better: add separate "click" / "toEdit" keys to locale files
```

**e) Avatar display detection — match on input name attribute:**
```typescript
// Before (line 117):
if (label && label.textContent?.toLowerCase().includes('avatar'))

// After — match on the field id instead of label text:
if (label && label.textContent?.toLowerCase() === 'avatar')
// Or even better: check the sibling input's name attribute
```

**f) Locale switching — re-initialize chart:**
```typescript
watch(locale, () => {
  // Destroy and recreate chart with new locale labels
  f3EditTree?.destroy()
  mountedAvatarApps.forEach(app => app.unmount())
  initChart()
})
```

### 6. AvatarUpload.vue & AvatarCropper.vue Changes

Replace all hardcoded strings with `useI18n().t()` calls:

| Current string | Translation key |
|---------------|-----------------|
| `'Upload fehlgeschlagen. Bitte versuche es erneut.'` | `t('ui.uploadFailed')` |
| `'Foto ändern'` | `t('ui.changePhoto')` |
| `'Abbrechen'` | `t('ui.cancel')` |
| `'Avatar zuschneiden'` | `t('ui.cropAvatar')` |
| `'Fertig'` | `t('ui.done')` |
| `'Pinch zum Zoomen, ziehen zum Verschieben'` | `t('ui.cropHint')` |

## Supported Locales

- `en` - English (fallback)
- `de` - German
- `da` - Danish

## What We Do NOT Need

- ❌ Transform layer (`fieldTransform.ts`) — not needed, `setFields` objects handle label/data separation
- ❌ Database migration — keys stay as-is
- ❌ Database deletion — no data changes at all

## Known Limitations (deferred)

- **Gender field labels are hardcoded in the library.** The family-chart library's `getGenderField()` always renders "Gender" / "Male" / "Female" in English. This is not configurable via `setFields()`. Fixing it would require DOM patching in `setOnFormCreation`. **Leaving as-is for now.**
- **Date display formatting.** Dates are stored as ISO strings (`"1980-01-15"`) and displayed raw on cards. Locale-aware formatting (e.g. `15.01.1980` for German) would be a natural i18n enhancement. **Deferred.**
- **Mid-edit locale switch.** If the user switches language while a form is open, chart re-initialization will discard unsaved form data. The language switcher UI and its behavior (auto-detect vs. manual, blocking during edits, saving first) have not been decided yet. **Deferred until language switcher is designed.**

## Execution Order

1. Create `i18n/` directory with composable and locale files
2. Create `LanguageSwitcher.vue` component
3. Update `FamilyChart.vue` to use i18n fields and translated labels
4. Update `AvatarUpload.vue` — replace hardcoded strings
5. Update `AvatarCropper.vue` — replace hardcoded strings
6. Add `LanguageSwitcher` to `AppHeader.vue`
7. Build & test: `cd client && bun run build`
