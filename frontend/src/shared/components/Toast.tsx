import React from 'react';
import { create } from 'zustand';
import { Icon } from './Icon';
import type { IconName } from './Icon';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (message, tone) => {
    const id = nextId++;
    set((state) => ({ items: [...state.items.slice(-3), { id, message, tone }] }));
    window.setTimeout(() => get().dismiss(id), tone === 'error' ? 6000 : 4200);
  },
  dismiss: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push(message, 'success'),
  error: (message: string) => useToastStore.getState().push(message, 'error'),
  info: (message: string) => useToastStore.getState().push(message, 'info'),
};

const toneStyles: Record<ToastTone, { surface: string; icon: IconName; label: string }> = {
  success: { surface: 'bg-forest text-white', icon: 'checkCircle', label: 'Listo' },
  error: { surface: 'bg-orange-dark text-white', icon: 'alert', label: 'Error' },
  info: { surface: 'bg-white text-forest border border-border', icon: 'info', label: 'Aviso' },
};

export const Toaster: React.FC = () => {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-5 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6"
    >
      {items.map((item) => {
        const style = toneStyles[item.tone];
        return (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-[20px] px-4 py-3.5 shadow-[0_18px_40px_-18px_rgba(16,38,42,0.55)] ${style.surface}`}
          >
            <Icon name={style.icon} size={19} className="mt-0.5 flex-none" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">{style.label}</p>
              <p className="mt-0.5 text-sm leading-snug">{item.message}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => dismiss(item.id)}
              className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-current opacity-70 transition-colors hover:bg-white/15 hover:opacity-100 focus-visible:outline-3 focus-visible:outline-orange"
            >
              <Icon name="close" size={15} strokeWidth={2.4} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
