import { create } from "zustand";

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 5;
const MAX_FONT_SIZE = 32;
const STEP = 1;

interface SettingsStore {
  fontSize: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  fontSize: DEFAULT_FONT_SIZE,

  increaseFontSize() {
    set((s) => ({ fontSize: Math.min(s.fontSize + STEP, MAX_FONT_SIZE) }));
  },

  decreaseFontSize() {
    set((s) => ({ fontSize: Math.max(s.fontSize - STEP, MIN_FONT_SIZE) }));
  },
}));
