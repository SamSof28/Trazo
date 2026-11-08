import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  IntakeQuestion,
  MissingField,
  TripRequestAnswer,
  TripRequestDto,
} from '@trazo/shared';
import { answerTripRequest, fetchTripRequest, generatePlan } from '../../shared/api/intake';
import { errorMessage } from '../../shared/api/client';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import type { IconName } from '../../shared/components/Icon';
import { toast } from '../../shared/components/Toast';
import {
  formatDateRange,
  formatMoney,
  travelerLabel,
  titleCase,
} from '../../shared/lib/format';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

const fieldIcon: Record<MissingField, IconName> = {
  destination: 'pin',
  duration: 'calendar',
  travelers: 'users',
  budget: 'wallet',
};

const fieldLabel: Record<MissingField, string> = {
  destination: 'Destino',
  duration: 'Fechas y duración',
  travelers: 'Viajeros',
  budget: 'Presupuesto',
};

const travelerTypeLabel: Record<NonNullable<TripRequestDto['slots']['travelerType']>, string> = {
  SOLO: 'Viaje solo',
  COUPLE: 'Pareja',
  FAMILY: 'Familia',
  FRIENDS: 'Amigos',
  BUSINESS: 'Negocios',
};

const generationStages = [
  'Interpretando tu solicitud',
  'Consultando el catálogo',
  'Armando el itinerario',
  'Calculando el presupuesto',
];

function statusMeta(status: TripRequestDto['status']): {
  label: string;
  variant: 'neutral' | 'active' | 'draft' | 'published' | 'archived';
} {
  switch (status) {
    case 'COLLECTING':
      return { label: 'Recopilando', variant: 'neutral' };
    case 'AWAITING_INPUT':
      return { label: 'Conversando', variant: 'draft' };
    case 'READY':
      return { label: 'Listo para trazar', variant: 'active' };
    case 'GENERATING':
      return { label: 'Trazando', variant: 'published' };
    case 'GENERATED':
      return { label: 'Plan listo', variant: 'published' };
    case 'FAILED':
      return { label: 'Revisar', variant: 'archived' };
  }
}

function budgetLabel(trip: TripRequestDto): string {
  const { budgetMin, budgetMax } = trip.slots;
  if (budgetMin && budgetMax) return `${formatMoney(budgetMin)} – ${formatMoney(budgetMax)}`;
  if (budgetMax) return `Hasta ${formatMoney(budgetMax)}`;
  if (budgetMin) return `Desde ${formatMoney(budgetMin)}`;
  return 'Por definir';
}

function introMessage(trip: TripRequestDto): string {
  const parts: string[] = [];
  if (trip.slots.destination) parts.push(trip.slots.destination.city);
  if (trip.slots.durationDays) parts.push(`${trip.slots.durationDays} días`);
  if (trip.slots.adults) parts.push(travelerLabel(trip.slots.adults, trip.slots.children));
  const summary = parts.length > 0 ? `Ya tengo ${parts.join(' · ')}.` : 'Empecemos por lo esencial.';

  if (trip.status === 'READY' || trip.status === 'GENERATING' || trip.status === 'GENERATED') {
    return `${summary} Ya tenemos lo esencial: revisa el contexto y traza el plan cuando quieras.`;
  }
  if (trip.status === 'FAILED') {
    return `${summary} La generación anterior no terminó. Puedes intentarlo otra vez sin perder lo conversado.`;
  }
  const pending = trip.questions.map((question) => question.prompt).join(' ');
  return `${summary} ${pending || 'Cuéntame un poco más para afinar el viaje.'}`;
}

function assistantReply(trip: TripRequestDto): string {
  if (trip.status === 'READY') {
    return 'Perfecto, ya tengo lo esencial. Revisa el contexto y traza el plan cuando quieras.';
  }
  if (trip.status === 'FAILED') {
    return 'Anotado. La generación falló; puedes reintentar desde el panel de la derecha.';
  }
  return 'Anotado. Con eso ajusto el viaje; sigue con lo que falta.';
}

const QuestionCard: React.FC<{
  question: IntakeQuestion;
  pending: boolean;
  onAnswer: (field: MissingField, value: string) => void;
}> = ({ question, pending, onAnswer }) => {
  const [draft, setDraft] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    onAnswer(question.field, value);
    setDraft('');
  };

  return (
    <div className="rounded-[20px] border-[1.5px] border-border bg-white p-4 shadow-[0_10px_24px_-18px_rgba(16,38,42,0.35)]">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-mint text-forest">
          <Icon name={fieldIcon[question.field]} size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {fieldLabel[question.field]}
          </p>
          <p className="mt-0.5 text-sm font-bold leading-snug text-forest">{question.prompt}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {question.chips.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={pending}
            onClick={() => onAnswer(question.field, chip)}
            className="min-h-[34px] cursor-pointer rounded-full border-[1.5px] border-border bg-sand px-3 text-xs font-medium text-forest transition-all hover:-translate-y-0.5 hover:border-teal hover:bg-teal disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-orange"
          >
            {chip}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-2.5 flex items-center gap-2">
        <label htmlFor={`answer-${question.field}`} className="sr-only">
          Otra respuesta para {fieldLabel[question.field]}
        </label>
        <input
          id={`answer-${question.field}`}
          type="text"
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value.slice(0, 200))}
          placeholder="O escribe otra respuesta…"
          className="min-h-[38px] w-full rounded-full border-[1.5px] border-border bg-sand px-3.5 text-xs text-forest placeholder:text-muted/55 focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-1"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label="Enviar respuesta"
          className="grid h-9 w-9 flex-none cursor-pointer place-items-center rounded-full border-0 bg-forest text-white transition-colors hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-orange"
        >
          <Icon name="send" size={15} />
        </button>
      </form>
    </div>
  );
};

export const WorkspaceIntakePage: React.FC = () => {
  const { tripRequestId } = useParams<{ tripRequestId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage, setStage] = useState(0);
  const initializedFor = useRef<string | null>(null);
  const messageCounter = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tripQuery = useQuery({
    queryKey: ['trip-request', tripRequestId],
    queryFn: () => fetchTripRequest(tripRequestId as string),
    enabled: Boolean(tripRequestId),
    refetchInterval: (query) =>
      query.state.data?.status === 'GENERATING' ? 1500 : false,
  });

  const trip = tripQuery.data;

  const appendMessage = (role: ChatMessage['role'], text: string) => {
    messageCounter.current += 1;
    setMessages((current) => [
      ...current,
      { id: `m-${messageCounter.current}`, role, text },
    ]);
  };

  useEffect(() => {
    if (!trip) return;
    if (initializedFor.current === trip.id) return;
    initializedFor.current = trip.id;
    setMessages([
      { id: 'prompt', role: 'user', text: trip.promptOriginal },
      { id: 'intro', role: 'assistant', text: introMessage(trip) },
    ]);
  }, [trip]);

  useEffect(() => {
    if (trip?.status === 'GENERATED' && trip.planId) {
      navigate(`/plans/${trip.planId}`, { replace: true });
    }
  }, [trip?.status, trip?.planId, navigate]);

  useEffect(() => {
    if (trip?.status !== 'GENERATING') {
      setStage(0);
      return;
    }
    setStage(0);
    const interval = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, generationStages.length - 1));
    }, 1500);
    return () => window.clearInterval(interval);
  }, [trip?.status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, trip?.questions.length]);

  const answerMutation = useMutation({
    mutationFn: (answer: TripRequestAnswer) =>
      answerTripRequest(tripRequestId as string, [answer]),
    onSuccess: (updated, answer) => {
      queryClient.setQueryData(['trip-request', tripRequestId], updated);
      appendMessage('user', answer.value);
      appendMessage('assistant', assistantReply(updated));
      toast.success('Anotado. El contexto se actualizó.');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'No pudimos guardar tu respuesta.'));
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generatePlan(tripRequestId as string),
    onSuccess: () => {
      queryClient.setQueryData<TripRequestDto>(
        ['trip-request', tripRequestId],
        (current) => (current ? { ...current, status: 'GENERATING' } : current),
      );
      toast.info('Estamos trazando el itinerario. Esto toma unos segundos.');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'No pudimos iniciar la generación.'));
    },
  });

  const handleAnswer = (field: MissingField, value: string) => {
    if (answerMutation.isPending) return;
    answerMutation.mutate({ field, value });
  };

  if (tripQuery.isLoading) {
    return (
      <div className="grid h-[calc(100dvh-64px)] place-items-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-forest border-t-transparent" />
          <p className="text-sm text-muted">Abriendo tu conversación…</p>
        </div>
      </div>
    );
  }

  if (tripQuery.isError || !trip) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-20 text-center">
        <Icon name="alert" size={40} className="mx-auto text-orange-dark" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">No encontramos este viaje.</h1>
        <p className="mt-2 text-sm text-muted">
          Puede que pertenezca a otra cuenta o que ya no exista.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white"
        >
          <Icon name="arrowLeft" size={16} /> Volver al inicio
        </Link>
      </div>
    );
  }

  const meta = statusMeta(trip.status);
  const isGenerating = trip.status === 'GENERATING';
  const isReady = trip.status === 'READY';
  const isFailed = trip.status === 'FAILED';
  const pendingField = answerMutation.isPending ? answerMutation.variables?.field : undefined;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col lg:h-[calc(100dvh-64px)] lg:flex-row lg:overflow-hidden">
      {/* Chat panel */}
      <aside className="flex w-full flex-col border-b border-divider bg-white lg:w-[430px] lg:flex-none lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-divider px-4 py-3">
          <Link
            to="/"
            aria-label="Volver al inicio"
            className="grid h-9 w-9 flex-none place-items-center rounded-full text-forest transition-colors hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="arrowLeft" size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg font-extrabold leading-tight">Nuevo viaje</p>
            <p className="truncate text-[11px] text-muted">
              {trip.slots.destination?.city ?? 'Conversación de intake'}
            </p>
          </div>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto bg-sand/60 px-4 py-5 lg:min-h-0"
          aria-live="polite"
        >
          {messages.map((message) => {
            if (message.role === 'system') {
              return (
                <div key={message.id} className="mx-auto max-w-[92%] rounded-[18px] bg-gold px-4 py-3 text-sm leading-relaxed text-forest">
                  {message.text}
                </div>
              );
            }
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[88%] ${isUser ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`rounded-[20px] px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'rounded-br-[5px] bg-forest text-white'
                        : 'rounded-bl-[5px] border border-mint bg-mint-light text-forest'
                    }`}
                  >
                    {message.text}
                  </div>
                  <p className="mt-1 px-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted/70">
                    {isUser ? 'Tú' : 'Trazo'}
                  </p>
                </div>
              </div>
            );
          })}

          {isGenerating ? (
            <div className="rounded-[20px] border border-teal/60 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 animate-pulse rounded-full bg-orange" aria-hidden="true" />
                <p className="text-sm font-bold text-forest">Trazando tu plan…</p>
              </div>
              <ol className="mt-3 space-y-2.5">
                {generationStages.map((label, index) => {
                  const done = index < stage;
                  const active = index === stage;
                  return (
                    <li key={label} className="flex items-center gap-2.5 text-xs">
                      <span
                        className={`grid h-6 w-6 flex-none place-items-center rounded-full ${
                          done
                            ? 'bg-teal text-forest'
                            : active
                              ? 'bg-gold text-forest'
                              : 'bg-sand text-muted'
                        }`}
                      >
                        {done ? (
                          <Icon name="check" size={12} strokeWidth={3} />
                        ) : active ? (
                          <span className="h-2 w-2 animate-pulse rounded-full bg-forest" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
                        )}
                      </span>
                      <span className={done || active ? 'font-medium text-forest' : 'text-muted'}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {isFailed ? (
            <div className="rounded-[20px] border border-orange-dark/30 bg-orange-dark/5 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-orange-dark">
                <Icon name="alert" size={16} /> La generación no terminó
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {trip.errorCode
                  ? `Código ${trip.errorCode}. Puedes reintentar sin perder la conversación.`
                  : 'Puedes reintentar sin perder la conversación.'}
              </p>
            </div>
          ) : null}

          {!isGenerating && !isFailed && trip.questions.length > 0
            ? trip.questions.map((question) => (
                <QuestionCard
                  key={question.field}
                  question={question}
                  pending={answerMutation.isPending}
                  onAnswer={handleAnswer}
                />
              ))
            : null}
        </div>

        {/* Bottom action */}
        <div className="border-t border-divider bg-white p-3.5">
          {isReady ? (
            <div className="rounded-[18px] bg-mint-light p-3">
              <p className="text-xs leading-relaxed text-forest">
                Ya tenemos lo esencial para trazar. Las fechas y el presupuesto se pueden afinar
                después, en el plan.
              </p>
              <Button
                variant="cta"
                size="md"
                fullWidth
                className="mt-2"
                isLoading={generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
              >
                <Icon name="sparkles" size={16} />
                {generateMutation.isPending ? 'Iniciando…' : 'Trazar mi plan'}
              </Button>
            </div>
          ) : isGenerating ? (
            <div className="flex items-center gap-2 rounded-[18px] bg-mint-light px-3.5 py-3 text-xs text-forest">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
              Consultando el catálogo y armando el itinerario…
            </div>
          ) : isFailed ? (
            <Button
              variant="primary"
              size="md"
              fullWidth
              isLoading={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <Icon name="refresh" size={16} /> Reintentar generación
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-[18px] bg-sand px-3.5 py-3 text-xs text-muted">
              <Icon name="info" size={15} className="flex-none" />
              Responde las preguntas de arriba. Trazo te pedirá máximo dos por turno.
            </div>
          )}
          <p className="mt-2 text-center text-[10px] text-muted/70">
            {pendingField ? `Guardando ${fieldLabel[pendingField].toLowerCase()}…` : 'Sin datos personales · Respuestas interpretadas en el servidor'}
          </p>
        </div>
      </aside>

      {/* Context panel */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Contexto del viaje
              </p>
              <h1 className="mt-1 font-heading text-3xl font-extrabold sm:text-4xl">
                {trip.slots.destination?.city ?? 'Un viaje por definir'}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {trip.slots.destination?.country ?? 'Colombia'} ·{' '}
                {formatDateRange(trip.slots.startDate, trip.slots.endDate)}
              </p>
            </div>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-divider bg-white p-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <Icon name="pin" size={14} /> Destino
              </p>
              <p className="mt-2 font-heading text-xl font-extrabold">
                {trip.slots.destination?.city ?? 'Por definir'}
              </p>
              <p className="text-xs text-muted">
                {trip.slots.destination?.country ?? 'Cuéntanos a dónde quieres ir'}
              </p>
              {trip.slots.destination ? (
                <Link
                  to={`/catalog/${trip.slots.destination.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-forest hover:underline"
                >
                  Ver ficha del destino <Icon name="arrowUpRight" size={13} />
                </Link>
              ) : null}
            </div>

            <div className="rounded-[22px] border border-divider bg-white p-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <Icon name="calendar" size={14} /> Duración
              </p>
              <p className="mt-2 font-heading text-xl font-extrabold">
                {trip.slots.durationDays ? `${trip.slots.durationDays} días` : 'Por definir'}
              </p>
              <p className="text-xs text-muted">
                {formatDateRange(trip.slots.startDate, trip.slots.endDate)}
              </p>
            </div>

            <div className="rounded-[22px] border border-divider bg-white p-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <Icon name="users" size={14} /> Viajeros
              </p>
              <p className="mt-2 font-heading text-xl font-extrabold">
                {trip.slots.adults
                  ? travelerLabel(trip.slots.adults, trip.slots.children)
                  : 'Por definir'}
              </p>
              <p className="text-xs text-muted">
                {trip.slots.travelerType
                  ? travelerTypeLabel[trip.slots.travelerType]
                  : 'Sin tipo de viaje definido'}
              </p>
            </div>

            <div className="rounded-[22px] border border-divider bg-white p-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <Icon name="wallet" size={14} /> Presupuesto
              </p>
              <p className="mt-2 font-heading text-xl font-extrabold">{budgetLabel(trip)}</p>
              <p className="text-xs text-muted">
                {trip.slots.budgetMin || trip.slots.budgetMax ? 'Por persona' : 'Aún sin definir'}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-[22px] border border-divider bg-white p-5">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              <Icon name="heart" size={14} /> Intereses
            </p>
            {trip.slots.interests.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trip.slots.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full bg-mint-light px-3 py-1.5 text-xs font-medium text-forest"
                  >
                    {titleCase(interest)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Todavía no nos has contado qué te gustaría vivir.
              </p>
            )}
          </div>

          {/* Progress */}
          <div className="mt-3 rounded-[22px] border border-divider bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Progreso</p>
            <ol className="mt-3 space-y-3">
              {[
                {
                  label: 'Conversación de intake',
                  detail: trip.missingFields.length === 0 ? 'Completa' : `${trip.missingFields.length} detalles pendientes`,
                  done: trip.missingFields.length === 0,
                },
                {
                  label: 'Itinerario con IA',
                  detail:
                    trip.status === 'GENERATED'
                      ? 'Listo'
                      : trip.status === 'GENERATING'
                        ? 'En proceso'
                        : 'Pendiente',
                  done: trip.status === 'GENERATED',
                },
                {
                  label: 'Presupuesto y PDF',
                  detail: trip.status === 'GENERATED' ? 'Disponible en el plan' : 'Después de generar',
                  done: trip.status === 'GENERATED',
                },
              ].map((step) => (
                <li key={step.label} className="flex items-center gap-3">
                  <span
                    className={`grid h-8 w-8 flex-none place-items-center rounded-full ${
                      step.done ? 'bg-teal text-forest' : 'bg-sand text-muted'
                    }`}
                  >
                    <Icon name={step.done ? 'check' : 'clock'} size={15} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight">{step.label}</p>
                    <p className="text-[11px] text-muted">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-3 rounded-[22px] border border-dashed border-border bg-mint-light/50 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-forest">
              <Icon name="info" size={16} /> Cómo responder
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Puedes usar los chips o escribir con tus palabras: “del 10 al 14 de diciembre”, “dos
              adultos y un niño”, “presupuesto medio”. El parser es determinista y no inventa datos.
            </p>
            <Link
              to="/catalog"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-forest hover:underline"
            >
              Ver catálogo mientras decides <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
