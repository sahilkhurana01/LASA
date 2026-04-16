import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light'

type AppState = {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  toggleTheme: () => void

  unreadAlerts: number
  setUnreadAlerts: (n: number) => void

  selectedEndpointId: string | null
  setSelectedEndpointId: (id: string | null) => void

  onboardingDone: boolean
  setOnboardingDone: (v: boolean) => void
}

const THEME_KEY = 'lasa.theme'
const ENDPOINT_KEY = 'lasa.selectedEndpointId'
const ONBOARD_KEY = 'lasa.onboardingDone'

function readLocal(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: (readLocal(THEME_KEY) as ThemeMode) || 'dark',
  setTheme: (t) => {
    writeLocal(THEME_KEY, t)
    set({ theme: t })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    writeLocal(THEME_KEY, next)
    set({ theme: next })
  },

  unreadAlerts: 0,
  setUnreadAlerts: (n) => set({ unreadAlerts: n }),

  selectedEndpointId: readLocal(ENDPOINT_KEY),
  setSelectedEndpointId: (id) => {
    writeLocal(ENDPOINT_KEY, id)
    set({ selectedEndpointId: id })
  },

  onboardingDone: readLocal(ONBOARD_KEY) === 'true',
  setOnboardingDone: (v) => {
    writeLocal(ONBOARD_KEY, v ? 'true' : 'false')
    set({ onboardingDone: v })
  },
}))

