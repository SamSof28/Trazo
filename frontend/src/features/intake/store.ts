import { create } from 'zustand';
import type { TripRequestDto, IntakeQuestion } from '@trazo/shared';
import {
  createTripRequest,
  getTripRequest,
  answerTripRequest,
  generateTripPlan,
} from '../../shared/api/client';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  questions?: IntakeQuestion[];
}

interface IntakeState {
  currentTripRequest: TripRequestDto | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  startIntake: (prompt: string) => Promise<TripRequestDto>;
  loadTripRequest: (id: string) => Promise<TripRequestDto>;
  sendAnswers: (answers: { field: 'destination' | 'duration' | 'travelers' | 'budget'; value: string }[]) => Promise<void>;
  requestGeneration: () => Promise<void>;
  clearError: () => void;
}

export const useIntakeStore = create<IntakeState>((set, get) => ({
  currentTripRequest: null,
  messages: [],
  isLoading: false,
  isGenerating: false,
  error: null,

  clearError: () => set({ error: null }),

  startIntake: async (prompt: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await createTripRequest({ prompt });
      const tr = response.tripRequest;

      const initialMessages: ChatMessage[] = [
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: prompt,
          timestamp: new Date().toISOString(),
        },
      ];

      if (tr.questions && tr.questions.length > 0) {
        initialMessages.push({
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: '¡Excelente! Para armar el itinerario perfecto, cuéntame un poco más:',
          timestamp: new Date().toISOString(),
          questions: tr.questions,
        });
      } else if (tr.status === 'READY') {
        initialMessages.push({
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: '¡Tengo toda la información necesaria! Ya podemos diseñar tu plan de viaje.',
          timestamp: new Date().toISOString(),
        });
      }

      set({
        currentTripRequest: tr,
        messages: initialMessages,
        isLoading: false,
      });

      return tr;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar la solicitud de viaje';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  loadTripRequest: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getTripRequest(id);
      const tr = response.tripRequest;

      const messages: ChatMessage[] = [
        {
          id: `initial-${tr.id}`,
          sender: 'user',
          text: tr.promptOriginal,
          timestamp: tr.createdAt,
        },
      ];

      if (tr.questions && tr.questions.length > 0) {
        messages.push({
          id: `ai-${tr.id}-questions`,
          sender: 'assistant',
          text: 'Aún necesitamos definir algunos detalles para completar tu itinerario:',
          timestamp: tr.updatedAt,
          questions: tr.questions,
        });
      } else if (tr.status === 'READY') {
        messages.push({
          id: `ai-${tr.id}-ready`,
          sender: 'assistant',
          text: '¡Información completa! La solicitud está lista para generar el itinerario.',
          timestamp: tr.updatedAt,
        });
      }

      set({
        currentTripRequest: tr,
        messages,
        isLoading: false,
        isGenerating: tr.status === 'GENERATING',
      });

      return tr;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar la solicitud';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  sendAnswers: async (answers) => {
    const { currentTripRequest, messages } = get();
    if (!currentTripRequest) return;

    set({ isLoading: true, error: null });

    // Mensaje del usuario reflejando lo seleccionado
    const answerSummary = answers.map((a) => a.value).join(', ');
    const updatedMessages: ChatMessage[] = [
      ...messages,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: answerSummary,
        timestamp: new Date().toISOString(),
      },
    ];
    set({ messages: updatedMessages });

    try {
      const response = await answerTripRequest(currentTripRequest.id, { answers });
      const tr = response.tripRequest;

      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        text: '',
      };

      if (tr.questions && tr.questions.length > 0) {
        aiReply.text = 'Perfecto, solo nos falta afinar lo siguiente:';
        aiReply.questions = tr.questions;
      } else if (tr.status === 'READY') {
        aiReply.text = '¡Listo! Hemos reunido todos los datos esenciales. Ya puedes generar el itinerario.';
      }

      set({
        currentTripRequest: tr,
        messages: [...updatedMessages, aiReply],
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar las respuestas';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  requestGeneration: async () => {
    const { currentTripRequest } = get();
    if (!currentTripRequest) return;

    set({ isGenerating: true, error: null });
    try {
      await generateTripPlan(currentTripRequest.id);
      set((state) => ({
        currentTripRequest: state.currentTripRequest
          ? { ...state.currentTripRequest, status: 'GENERATING' }
          : null,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al solicitar generación';
      set({ error: msg, isGenerating: false });
      throw err;
    }
  },
}));
