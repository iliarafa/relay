import { create } from 'zustand'

/** Dialog visibility that more than one component needs to drive. */
export interface UiState {
  settingsOpen: boolean
  aboutOpen: boolean
  setSettingsOpen: (open: boolean) => void
  setAboutOpen: (open: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  settingsOpen: false,
  aboutOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
}))
