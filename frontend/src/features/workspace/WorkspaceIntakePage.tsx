import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntakeStore } from '../intake/store';
import { getTripRequest } from '../../shared/api/client';
import { Button } from '../../shared/components/Button';
import { Chip } from '../../shared/components/Chip';
import { Badge } from '../../shared/components/Badge';

export const WorkspaceIntakePage: React.FC = () => {
  const { tripRequestId } = useParams<{ tripRequestId: string }>();
  const navigate = useNavigate();

  const {
    currentTripRequest,
    messages,
    isLoading,
    isGenerating,
    error,
    loadTripRequest,
    sendAnswers,
    requestGeneration,
  } = useIntakeStore();

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [customInput, setCustomInput] = useState('');
  const [generationStage, setGenerationStage] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar tripRequest si no está en memoria o cambia el ID
  useEffect(() => {
    if (tripRequestId && (!currentTripRequest || currentTripRequest.id !== tripRequestId)) {
      void loadTripRequest(tripRequestId);
    }
  }, [tripRequestId, currentTripRequest, loadTripRequest]);

  // Scroll automático hacia el final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isGenerating]);

  // Polling cuando esté en estado GENERATING
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let stageInterval: NodeJS.Timeout | null = null;

    if (isGenerating || currentTripRequest?.status === 'GENERATING') {
      // Simular etapas de generación visuales (HU 1.4)
      stageInterval = setInterval(() => {
        setGenerationStage((prev) => (prev + 1) % 4);
      }, 2500);

      const poll = async () => {
        if (!tripRequestId) return;
        try {
          const res = await getTripRequest(tripRequestId);
          const tr = res.tripRequest;
          if (tr.status === 'GENERATED' && tr.planId) {
            navigate(`/plans/${tr.planId}`);
          } else if (tr.status === 'FAILED') {
            useIntakeStore.setState({
              isGenerating: false,
              error: tr.errorCode ? `Fallo en generación: ${tr.errorCode}` : 'No se pudo generar el plan.',
            });
          } else {
            timer = setTimeout(poll, 2000);
          }
        } catch {
          timer = setTimeout(poll, 3000);
        }
      };

      timer = setTimeout(poll, 1500);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (stageInterval) clearInterval(stageInterval);
    };
  }, [isGenerating, currentTripRequest?.status, tripRequestId, navigate]);

  const handleSelectChip = (field: string, chipValue: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [field]: chipValue,
    }));
  };

  const handleSendAnswers = async () => {
    const entries = Object.entries(selectedAnswers);
    if (entries.length === 0 && !customInput.trim()) return;

    const answersToSend: { field: 'destination' | 'duration' | 'travelers' | 'budget'; value: string }[] =
      entries.map(([field, value]) => ({
        field: field as 'destination' | 'duration' | 'travelers' | 'budget',
        value,
      }));

    if (customInput.trim() && currentTripRequest?.questions?.[0]) {
      const targetField = currentTripRequest.questions[0].field;
      if (!selectedAnswers[targetField]) {
        answersToSend.push({
          field: targetField,
          value: customInput.trim(),
        });
      }
    }

    setSelectedAnswers({});
    setCustomInput('');

    try {
      await sendAnswers(answersToSend);
    } catch {
      // Manejado por store
    }
  };

  const stagesText = [
    'Interpretando tu solicitud con IA...',
    'Consultando el catálogo oficial de destinos y hoteles...',
    'Armando el itinerario día a día...',
    'Calculando y optimizando el presupuesto...',
  ];

  if (!currentTripRequest && isLoading) {
    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center">
        <span className="w-10 h-10 border-4 border-forest border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted font-sans font-medium">Cargando el espacio de trabajo...</p>
      </div>
    );
  }

  const isReady = currentTripRequest?.status === 'READY';
  const pendingQuestions = currentTripRequest?.questions ?? [];

  return (
    <div className="min-h-screen bg-sand text-forest flex flex-col h-screen overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-border px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-full bg-sand hover:bg-mint flex items-center justify-center font-bold text-forest transition-colors"
            title="Volver al inicio"
          >
            ←
          </button>
          <div>
            <h1 className="font-heading font-extrabold text-lg leading-tight text-forest">
              Diseño de Plan Turístico
            </h1>
            <p className="text-xs text-muted truncate max-w-md">
              {currentTripRequest?.promptOriginal}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant={
              isReady
                ? 'active'
                : isGenerating
                ? 'draft'
                : 'neutral'
            }
          >
            {isGenerating
              ? 'Generando con IA'
              : isReady
              ? 'Listo para generar'
              : 'Faltan datos'}
          </Badge>
          {isReady && !isGenerating && (
            <Button
              variant="cta"
              size="sm"
              onClick={requestGeneration}
              disabled={isGenerating}
            >
              Generar Plan Ahora 🚀
            </Button>
          )}
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Conversational Chat */}
        <div className="w-full lg:w-3/5 flex flex-col bg-sand border-r border-border h-full">
          {/* Chat message history */}
          <div
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
            aria-live="polite"
          >
            {messages.map((msg) => {
              const isAssistant = msg.sender === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div className="flex items-end gap-2 max-w-[85%]">
                    {isAssistant && (
                      <span className="w-7 h-7 rounded-full bg-forest text-mint flex items-center justify-center text-xs font-bold shrink-0 mb-1">
                        IA
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed ${
                        isAssistant
                          ? 'bg-white text-forest shadow-xs border border-border/60 rounded-tl-sm'
                          : 'bg-forest text-white shadow-xs rounded-tr-sm'
                      }`}
                    >
                      <p>{msg.text}</p>

                      {/* Display Question Prompt and Chips inside message if available */}
                      {msg.questions && msg.questions.length > 0 && (
                        <div className="mt-4 space-y-4 pt-3 border-t border-border/40">
                          {msg.questions.map((q) => (
                            <div key={q.field} className="space-y-2">
                              <p className="font-heading font-bold text-sm text-forest">
                                {q.prompt}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {q.chips.map((chipText) => {
                                  const isSelected = selectedAnswers[q.field] === chipText;
                                  return (
                                    <Chip
                                      key={chipText}
                                      variant={isSelected ? 'default' : 'mint'}
                                      active={isSelected}
                                      onClick={() => handleSelectChip(q.field, chipText)}
                                      className="text-xs py-1 px-3 min-h-[32px]"
                                    >
                                      {chipText}
                                    </Chip>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* AI Thinking / Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted text-sm pl-9">
                <span className="w-2 h-2 rounded-full bg-forest animate-ping" />
                <span>Analizando respuestas...</span>
              </div>
            )}

            {/* Generación en progreso (HU 1.4) */}
            {isGenerating && (
              <div className="bg-white rounded-2xl p-5 border border-forest/20 shadow-md max-w-lg mx-auto my-6 text-center">
                <div className="w-12 h-12 rounded-full bg-mint flex items-center justify-center mx-auto mb-3 animate-pulse text-xl">
                  ✨
                </div>
                <h3 className="font-heading font-bold text-lg text-forest mb-1">
                  Creando tu itinerario personalizado
                </h3>
                <p className="text-sm font-medium text-orange-dark transition-all duration-300">
                  {stagesText[generationStage]}
                </p>
                <div className="w-full bg-sand h-2 rounded-full mt-4 overflow-hidden">
                  <div
                    className="bg-orange h-full transition-all duration-500 rounded-full"
                    style={{ width: `${(generationStage + 1) * 25}%` }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Response Action Bar */}
          {!isGenerating && (
            <div className="p-4 bg-white border-t border-border shrink-0">
              {error && (
                <div className="mb-3 text-xs text-orange-dark bg-orange/10 p-2.5 rounded-xl font-medium">
                  {error}
                </div>
              )}

              {isReady ? (
                <div className="flex items-center justify-between p-3 bg-mint-light rounded-2xl border border-teal/40">
                  <div>
                    <p className="font-heading font-bold text-sm text-forest">
                      ¡Todos los datos están listos!
                    </p>
                    <p className="text-xs text-muted">
                      Ya podemos llamar a la IA para seleccionar ítems de catálogo y armar tu plan.
                    </p>
                  </div>
                  <Button variant="cta" size="md" onClick={requestGeneration}>
                    Generar Itinerario
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Si hay preguntas pendientes, sugerir responderlas */}
                  {Object.keys(selectedAnswers).length > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted bg-sand p-2.5 rounded-xl">
                      <span>
                        Seleccionaste:{' '}
                        <strong>
                          {Object.values(selectedAnswers).join(' • ')}
                        </strong>
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSendAnswers}
                        disabled={isLoading}
                      >
                        Confirmar Selección
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSendAnswers();
                      }}
                      placeholder={
                        pendingQuestions.length > 0
                          ? `Escribe tu respuesta para "${pendingQuestions[0].prompt}"...`
                          : 'Escribe aquí tu respuesta...'
                      }
                      className="flex-1 bg-sand border border-border rounded-full px-4 py-2.5 text-sm text-forest outline-none focus:border-forest"
                      disabled={isLoading}
                    />
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleSendAnswers}
                      disabled={isLoading || (!customInput.trim() && Object.keys(selectedAnswers).length === 0)}
                    >
                      Enviar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Slots & Destination Preview */}
        <div className="hidden lg:flex w-2/5 flex-col bg-white overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="font-heading font-bold text-xl text-forest mb-1">
              Detalles del viaje
            </h2>
            <p className="text-xs text-muted">
              Información detectada y validada en tiempo real.
            </p>
          </div>

          {/* Destination Card Preview */}
          <div className="rounded-2xl border border-border p-4 bg-sand/50">
            <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
              Destino
            </span>
            {currentTripRequest?.slots?.destination ? (
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-forest text-white flex items-center justify-center text-lg">
                  📍
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-forest">
                    {currentTripRequest.slots.destination.city}
                  </h3>
                  <p className="text-xs text-muted">
                    {currentTripRequest.slots.destination.country}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted italic flex items-center gap-2">
                <span>⚠️</span> Pendiente por definir
              </div>
            )}
          </div>

          {/* Slots Checklist */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted block">
              Parámetros de itinerario
            </span>

            {/* Duración */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/80">
              <span className="text-sm font-medium text-forest">Duración:</span>
              <span className="text-sm font-bold text-forest">
                {currentTripRequest?.slots?.durationDays
                  ? `${currentTripRequest.slots.durationDays} días`
                  : '—'}
              </span>
            </div>

            {/* Viajeros */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/80">
              <span className="text-sm font-medium text-forest">Viajeros:</span>
              <span className="text-sm font-bold text-forest">
                {currentTripRequest?.slots?.adults !== null && currentTripRequest?.slots?.adults !== undefined
                  ? `${currentTripRequest.slots.adults} adultos${
                      currentTripRequest.slots.children > 0
                        ? `, ${currentTripRequest.slots.children} niños`
                        : ''
                    }`
                  : '—'}
              </span>
            </div>

            {/* Presupuesto */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/80">
              <span className="text-sm font-medium text-forest">Presupuesto máx:</span>
              <span className="text-sm font-bold text-forest">
                {currentTripRequest?.slots?.budgetMax
                  ? `$${(currentTripRequest.slots.budgetMax.amountMinor / 100).toLocaleString('es-CO')} COP`
                  : '—'}
              </span>
            </div>

            {/* Intereses */}
            <div className="p-3 rounded-xl border border-border/80">
              <span className="text-sm font-medium text-forest block mb-1.5">
                Intereses:
              </span>
              <div className="flex flex-wrap gap-1">
                {currentTripRequest?.slots?.interests && currentTripRequest.slots.interests.length > 0 ? (
                  currentTripRequest.slots.interests.map((interest) => (
                    <span
                      key={interest}
                      className="text-xs bg-mint px-2.5 py-0.5 rounded-full font-medium text-forest"
                    >
                      {interest}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted italic">Sin preferencias específicas</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Help Box */}
          <div className="mt-auto bg-mint-light p-4 rounded-2xl border border-teal/40 text-xs text-muted leading-relaxed">
            <strong className="text-forest block mb-1">¿Cómo funciona?</strong>
            Nuestro motor determinista extrae los datos clave. Al completar destino, duración, viajeros y presupuesto, se habilitará la generación con IA anclada al catálogo.
          </div>
        </div>
      </div>
    </div>
  );
};
