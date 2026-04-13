import { ref, computed } from 'vue'
import en from './locales/en.json'
import de from './locales/de.json'
import da from './locales/da.json'

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : K }[keyof T & string]
  : never

export type LocaleKey = NestedKeyOf<typeof en>
export type LocaleCode = 'en' | 'de' | 'da'

export const SUPPORTED_LOCALES: { code: LocaleCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'da', label: 'Dansk' },
]

const messages: Record<LocaleCode, typeof en> = { en, de, da }

const STORAGE_KEY = 'locale'

function detectLocale(): LocaleCode {
  const stored = localStorage.getItem(STORAGE_KEY) as LocaleCode | null
  if (stored && messages[stored]) return stored

  const browserLang = navigator.language.split('-')[0] as LocaleCode
  if (messages[browserLang]) return browserLang

  return 'en'
}

const locale = ref<LocaleCode>(detectLocale())

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

function t(key: string): string {
  return getNestedValue(messages[locale.value], key)
    ?? getNestedValue(messages.en, key)
    ?? key
}

function setLocale(code: LocaleCode) {
  locale.value = code
  localStorage.setItem(STORAGE_KEY, code)
}

export function useI18n() {
  return {
    locale: computed(() => locale.value),
    localeRef: locale,
    t,
    setLocale,
    supportedLocales: SUPPORTED_LOCALES,
  }
}
