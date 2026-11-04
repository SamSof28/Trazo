import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlanStore } from '../plans/store';
import { formatMoney } from '@trazo/shared';
import { Button } from '../../shared/components/Button';
import { Badge } from '../../shared/components/Badge';
import { Modal } from '../../shared/components/Modal';

export const WorkspacePlanPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  const {
    plan,
    selectedDay,
    isLoading,
    isSaving,
    error,
    activeItemForAlternatives,
    alternatives,
    isLoadingAlternatives,
    loadPlan,
    setSelectedDay,
    openAlternativesModal,
    closeAlternativesModal,
    selectAlternative,
    removeItem,
    updateMargin,
    saveCurrentPlan,
    publishCurrentPlan,
    downloadPdf,
  } = usePlanStore();

  const [marginInput, setMarginInput] = useState<number>(10);
  const [isEditingMargin, setIsEditingMargin] = useState(false);

  useEffect(() => {
    if (planId) {
      void loadPlan(planId);
    }
  }, [planId, loadPlan]);

  useEffect(() => {
    if (plan?.budget?.marginPercent !== undefined) {
      setMarginInput(plan.budget.marginPercent);
    }
  }, [plan?.budget?.marginPercent]);

  if (isLoading || !plan) {
    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 text-center">
        <span className="w-10 h-10 border-4 border-forest border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted font-sans font-medium">Cargando itinerario y presupuesto...</p>
      </div>
    );
  }

  const currentDayData = plan.days.find((d) => d.dayNumber === selectedDay) ?? plan.days[0];
  const isEditable = plan.status === 'DRAFT' || plan.status === 'SAVED';

  const handleSaveMargin = async () => {
    setIsEditingMargin(false);
    if (marginInput >= 0 && marginInput <= 100) {
      await updateMargin(marginInput);
    }
  };

  const getItemTypeBadge = (type: string) => {
    switch (type) {
      case 'ACCOMMODATION':
        return <Badge variant="draft">Hotel</Badge>;
      case 'ACTIVITY':
        return <Badge variant="active">Actividad</Badge>;
      case 'TRANSPORT':
        return <Badge variant="published">Transporte</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-sand text-forest flex flex-col">
      {/* Top Bar Header */}
      <header className="bg-white border-b border-border px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-full bg-sand hover:bg-mint flex items-center justify-center font-bold text-forest transition-colors"
            title="Volver"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-xl leading-tight text-forest">
                {plan.title ?? `Plan en ${plan.destination.city}`}
              </h1>
              <Badge variant={plan.status.toLowerCase() as 'draft' | 'saved' | 'published'}>
                {plan.status}
              </Badge>
            </div>
            <p className="text-xs text-muted">
              {plan.destination.city}, {plan.destination.country} • {plan.days.length} días
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-orange-dark font-medium mr-2 max-w-xs truncate">
              {error}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadPdf()}
            disabled={isSaving}
          >
            Descargar PDF 📄
          </Button>

          {isEditable && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void saveCurrentPlan()}
                disabled={isSaving}
              >
                Guardar Borrador
              </Button>
              <Button
                variant="cta"
                size="sm"
                onClick={() => void publishCurrentPlan()}
                disabled={isSaving}
              >
                Publicar Plan 🚀
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero Banner Section (HU 2.1) */}
      <section className="relative h-48 sm:h-64 bg-forest overflow-hidden shrink-0">
        {plan.heroImageUrl || plan.destination.heroImageUrl ? (
          <img
            src={plan.heroImageUrl ?? plan.destination.heroImageUrl ?? ''}
            alt={plan.destination.city}
            className="w-full h-full object-cover opacity-65"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/40 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {plan.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-white/20 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-full text-xs font-semibold"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h2 className="font-heading font-black text-2xl sm:text-4xl leading-tight">
              {plan.summary ?? `Itinerario completo para descubrir ${plan.destination.city}`}
            </h2>
          </div>
        </div>
      </section>

      {/* Main Content: Split Timeline & Budget Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Itinerary Timeline by Days (HU 2.2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Day Tabs Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border">
            {plan.days.map((d) => {
              const isSelected = d.dayNumber === selectedDay;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDay(d.dayNumber)}
                  className={`px-4 py-2.5 rounded-2xl font-sans text-sm font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-forest text-white shadow-xs'
                      : 'bg-white text-forest border border-border hover:bg-mint-light'
                  }`}
                >
                  Día {d.dayNumber}
                  <span className="block text-[11px] font-normal opacity-80">
                    {formatMoney(d.subtotal)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Current Day Details & Items */}
          {currentDayData && (
            <div className="bg-white rounded-3xl p-6 border border-border shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <h3 className="font-heading font-extrabold text-xl text-forest">
                    Día {currentDayData.dayNumber}: {currentDayData.title ?? 'Actividades programadas'}
                  </h3>
                  <p className="text-xs text-muted">Fecha: {currentDayData.date}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted block">Subtotal del día</span>
                  <span className="font-heading font-bold text-lg text-forest">
                    {formatMoney(currentDayData.subtotal)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {currentDayData.items.length === 0 ? (
                  <p className="text-sm text-muted italic text-center py-6">
                    No hay actividades registradas para este día.
                  </p>
                ) : (
                  currentDayData.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-sand/60 border border-border/80 hover:border-forest/40 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-mint flex items-center justify-center shrink-0 font-heading font-bold text-lg">
                          {item.type === 'ACCOMMODATION'
                            ? '🏨'
                            : item.type === 'TRANSPORT'
                            ? '✈️'
                            : '🎯'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {getItemTypeBadge(item.type)}
                            {item.startTime && (
                              <span className="text-xs font-semibold text-muted">
                                🕒 {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                              </span>
                            )}
                          </div>
                          <h4 className="font-heading font-bold text-base text-forest leading-snug">
                            {item.name}
                          </h4>
                          <p className="text-xs text-muted">
                            {item.quantity} x {formatMoney(item.unitPrice)} ({item.pricingUnit})
                            {item.notes ? ` • ${item.notes}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                        <span className="font-heading font-bold text-base text-forest">
                          {formatMoney(item.subtotal)}
                        </span>

                        {isEditable && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs py-1 px-2.5 min-h-[30px]"
                              onClick={() => void openAlternativesModal(item)}
                            >
                              Cambiar 🔄
                            </Button>
                            <Button
                              variant="danger-outline"
                              size="sm"
                              className="text-xs py-1 px-2.5 min-h-[30px]"
                              onClick={() => void removeItem(item.id)}
                            >
                              Quitar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Budget Breakdown Card (HU 2.1 & 2.9) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-border shadow-sm sticky top-24 space-y-6">
            <div>
              <h3 className="font-heading font-extrabold text-xl text-forest mb-1">
                Presupuesto del Plan
              </h3>
              <p className="text-xs text-muted">
                Calculado en servidor con precios oficiales del catálogo.
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-3 pt-2 text-sm">
              <div className="flex items-center justify-between text-muted">
                <span>Vuelos / Transporte:</span>
                <span className="font-semibold text-forest">
                  {formatMoney(plan.budget.flights)}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Alojamiento:</span>
                <span className="font-semibold text-forest">
                  {formatMoney(plan.budget.hotels)}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Actividades:</span>
                <span className="font-semibold text-forest">
                  {formatMoney(plan.budget.activities)}
                </span>
              </div>

              <div className="border-t border-border/80 pt-3 flex items-center justify-between text-forest font-bold">
                <span>Subtotal neto:</span>
                <span>{formatMoney(plan.budget.subtotal)}</span>
              </div>

              {/* Margen de Agencia (HU 2.9) */}
              <div className="bg-mint-light p-3 rounded-2xl space-y-2 border border-teal/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-forest uppercase">
                    Margen Agencia ({plan.budget.marginPercent}%)
                  </span>
                  {isEditable && (
                    <button
                      onClick={() => setIsEditingMargin(!isEditingMargin)}
                      className="text-xs text-orange font-bold hover:underline"
                    >
                      {isEditingMargin ? 'Cerrar' : 'Ajustar'}
                    </button>
                  )}
                </div>

                {isEditingMargin ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={marginInput}
                      onChange={(e) => setMarginInput(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-white border border-border rounded-lg px-2 py-1 text-sm text-forest"
                    />
                    <span className="text-xs text-muted">%</span>
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs py-1 px-3 min-h-[30px]"
                      onClick={() => void handleSaveMargin()}
                    >
                      Aplicar
                    </Button>
                  </div>
                ) : null}

                <div className="flex items-center justify-between text-xs text-muted pt-1">
                  <span>Ganancia estimada:</span>
                  <span className="font-bold text-forest">
                    {formatMoney(plan.budget.margin)}
                  </span>
                </div>
              </div>

              {/* Gran Total */}
              <div className="border-t-2 border-forest pt-4 flex items-baseline justify-between">
                <div>
                  <span className="font-heading font-black text-xs text-muted uppercase tracking-wider block">
                    Precio Total Plan
                  </span>
                  <span className="text-[11px] text-muted">Moneda oficial: {plan.currency}</span>
                </div>
                <span className="font-heading font-black text-2xl text-forest">
                  {formatMoney(plan.budget.total)}
                </span>
              </div>
            </div>

            {isEditable && (
              <Button
                variant="cta"
                size="lg"
                fullWidth
                onClick={() => void publishCurrentPlan()}
                disabled={isSaving}
              >
                Publicar Itinerario Oficial
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alternativas de Catálogo (HU 2.3) */}
      <Modal
        isOpen={Boolean(activeItemForAlternatives)}
        onClose={closeAlternativesModal}
        title={
          <span>
            Cambiar <strong>{activeItemForAlternatives?.name}</strong>
          </span>
        }
        maxWidth="lg"
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted">
            Selecciona una opción equivalente del catálogo para reemplazar este ítem. El presupuesto
            se recalculará en el servidor automáticamente.
          </p>

          {isLoadingAlternatives ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <span className="w-8 h-8 border-3 border-forest border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs text-muted">Consultando opciones del catálogo...</span>
            </div>
          ) : alternatives.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted italic">
              No hay alternativas disponibles para esta categoría en este destino.
            </div>
          ) : (
            <div className="space-y-3">
              {alternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-border hover:border-forest/60 transition-colors bg-sand/40"
                >
                  <div className="space-y-1">
                    <h5 className="font-heading font-bold text-sm text-forest leading-snug">
                      {alt.name}
                    </h5>
                    <p className="text-xs text-muted">
                      {formatMoney(alt.price)} ({alt.pricingUnit})
                      {alt.durationMinutes ? ` • ${alt.durationMinutes} min` : ''}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void selectAlternative(alt.id)}
                    disabled={isSaving}
                  >
                    Elegir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
