import { create } from 'zustand';

export interface CookiePreferences {
  necessary: true;
  drafts: boolean;
  analytics: boolean;
}

interface CookieStoreState {
  hasConsent: boolean;
  preferences: CookiePreferences;
  isModalOpen: boolean;
  setConsent: (prefs: Partial<CookiePreferences>) => void;
  acceptAll: () => void;
  acceptNecessaryOnly: () => void;
  openModal: () => void;
  closeModal: () => void;
}

const STORAGE_KEY = 'trazo_cookie_consent';

function loadSavedPreferences(): { hasConsent: boolean; preferences: CookiePreferences } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        hasConsent: false,
        preferences: { necessary: true, drafts: true, analytics: false },
      };
    }
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
    return {
      hasConsent: true,
      preferences: {
        necessary: true,
        drafts: parsed.drafts ?? true,
        analytics: parsed.analytics ?? false,
      },
    };
  } catch {
    return {
      hasConsent: false,
      preferences: { necessary: true, drafts: true, analytics: false },
    };
  }
}

const initial = loadSavedPreferences();

export const useCookieStore = create<CookieStoreState>((set, get) => ({
  hasConsent: initial.hasConsent,
  preferences: initial.preferences,
  isModalOpen: false,

  setConsent: (newPrefs) => {
    const updated: CookiePreferences = {
      necessary: true,
      drafts: newPrefs.drafts ?? get().preferences.drafts,
      analytics: newPrefs.analytics ?? get().preferences.analytics,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    set({ preferences: updated, hasConsent: true, isModalOpen: false });
  },

  acceptAll: () => {
    get().setConsent({ drafts: true, analytics: true });
  },

  acceptNecessaryOnly: () => {
    get().setConsent({ drafts: false, analytics: false });
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));
