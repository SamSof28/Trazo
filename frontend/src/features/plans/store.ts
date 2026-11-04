import { create } from 'zustand';
import type { PlanDto, PlanAlternativeDto, PlanItemDto } from '@trazo/shared';
import {
  getPlan,
  getPlanAlternatives,
  replacePlanItem,
  deletePlanItem,
  savePlan,
  publishPlan,
  updatePlan,
  downloadPlanPdf,
} from '../../shared/api/client';

interface PlanWorkspaceState {
  plan: PlanDto | null;
  selectedDay: number;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Modal alternativas
  activeItemForAlternatives: PlanItemDto | null;
  alternatives: PlanAlternativeDto[];
  isLoadingAlternatives: boolean;

  loadPlan: (id: string) => Promise<PlanDto>;
  setSelectedDay: (day: number) => void;
  openAlternativesModal: (item: PlanItemDto) => Promise<void>;
  closeAlternativesModal: () => void;
  selectAlternative: (alternativeId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateMargin: (marginPercent: number) => Promise<void>;
  saveCurrentPlan: () => Promise<void>;
  publishCurrentPlan: () => Promise<void>;
  downloadPdf: () => Promise<void>;
}

export const usePlanStore = create<PlanWorkspaceState>((set, get) => ({
  plan: null,
  selectedDay: 1,
  isLoading: false,
  isSaving: false,
  error: null,

  activeItemForAlternatives: null,
  alternatives: [],
  isLoadingAlternatives: false,

  setSelectedDay: (day) => set({ selectedDay: day }),

  loadPlan: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getPlan(id);
      set({
        plan: response.plan,
        selectedDay: response.plan.days[0]?.dayNumber ?? 1,
        isLoading: false,
      });
      return response.plan;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar el plan';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  openAlternativesModal: async (item: PlanItemDto) => {
    const { plan } = get();
    if (!plan) return;

    set({
      activeItemForAlternatives: item,
      alternatives: [],
      isLoadingAlternatives: true,
    });

    try {
      const res = await getPlanAlternatives(plan.id, item.id);
      set({ alternatives: res.alternatives, isLoadingAlternatives: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar alternativas';
      set({ error: msg, isLoadingAlternatives: false });
    }
  },

  closeAlternativesModal: () => {
    set({
      activeItemForAlternatives: null,
      alternatives: [],
      isLoadingAlternatives: false,
    });
  },

  selectAlternative: async (alternativeId: string) => {
    const { plan, activeItemForAlternatives } = get();
    if (!plan || !activeItemForAlternatives) return;

    set({ isSaving: true, error: null });
    try {
      const response = await replacePlanItem(plan.id, activeItemForAlternatives.id, {
        catalogItemId: alternativeId,
      });
      set({
        plan: response.plan,
        activeItemForAlternatives: null,
        alternatives: [],
        isSaving: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al sustituir ítem';
      set({ error: msg, isSaving: false });
    }
  },

  removeItem: async (itemId: string) => {
    const { plan } = get();
    if (!plan) return;

    set({ isSaving: true, error: null });
    try {
      const response = await deletePlanItem(plan.id, itemId);
      set({ plan: response.plan, isSaving: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar ítem';
      set({ error: msg, isSaving: false });
    }
  },

  updateMargin: async (marginPercent: number) => {
    const { plan } = get();
    if (!plan) return;

    set({ isSaving: true, error: null });
    try {
      const response = await updatePlan(plan.id, { marginPercent });
      set({ plan: response.plan, isSaving: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar margen';
      set({ error: msg, isSaving: false });
    }
  },

  saveCurrentPlan: async () => {
    const { plan } = get();
    if (!plan) return;

    set({ isSaving: true, error: null });
    try {
      const response = await savePlan(plan.id);
      set({ plan: response.plan, isSaving: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el plan';
      set({ error: msg, isSaving: false });
    }
  },

  publishCurrentPlan: async () => {
    const { plan } = get();
    if (!plan) return;

    set({ isSaving: true, error: null });
    try {
      const response = await publishPlan(plan.id);
      set({ plan: response.plan, isSaving: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al publicar el plan';
      set({ error: msg, isSaving: false });
    }
  },

  downloadPdf: async () => {
    const { plan } = get();
    if (!plan) return;

    try {
      const blob = await downloadPlanPdf(plan.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Plan-${plan.destination.city}-${plan.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar PDF';
      set({ error: msg });
    }
  },
}));
