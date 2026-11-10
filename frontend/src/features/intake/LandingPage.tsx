import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { DestinationDto } from '@trazo/shared';
import { createTripRequest } from '../../shared/api/intake';
import { listDestinations } from '../../shared/api/catalog';
import { errorMessage } from '../../shared/api/client';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { Logo } from '../../shared/components/Logo';
import { toast } from '../../shared/components/Toast';
import { formatMoneyShort, titleCase } from '../../shared/lib/format';
import { destinationImage } from '../../shared/lib/images';

const promptExamples = [
  'Cinco días en Cartagena para dos, con playa y gastronomía.',
  'Un fin de semana en Guatapé para cuatro amigos.',
  'Una semana en el Eje Cafetero en familia, ritmo tranquilo.',
];

const steps = [
  {
    number: '01',
    icon: 'sparkles' as const,
    title: 'Cuéntanos el viaje',
    body: 'Una frase basta. Trazo pregunta solo lo que falta: destino, fechas, viajeros y presupuesto.',
  },
  {
    number: '02',
    icon: 'route' as const,
    title: 'Trazamos el itinerario',
    body: 'La IA propone sobre nuestro catálogo real. Cada hotel, actividad y trayecto se puede cambiar.',
  },
  {
    number: '03',
    icon: 'send' as const,
    title: 'Lo haces tuyo',
    body: 'Ajustas el margen, publicas el plan y descargas un PDF con la identidad de la agencia.',
  },
];

const DestinationCard: React.FC<{ destination: DestinationDto }> = ({ destination }) => {
  const image = destinationImage(destination.slug, destination.heroImageUrl);

  return (
    <Link
      to={`/catalog/${destination.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-divider bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-24px_rgba(16,38,42,0.35)] focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
    >
      <div className="relative h-44 overflow-hidden bg-mint">
        {image ? (
          <img
            src={image}
            alt={`Imagen de ${destination.city}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#CFEAE3,#9ADBCB)] text-forest/40">
            <Icon name="mountain" size={54} strokeWidth={1.4} />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,42,0.02)_30%,rgba(16,38,42,0.78))]" />
        {destination.isFeatured ? (
          <span className="absolute left-4 top-4 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-forest">
            Destacado
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="font-heading text-[22px] font-extrabold leading-tight">{destination.city}</p>
          <p className="text-xs font-medium text-white/75">{destination.country}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
          {destination.description ?? 'Un destino del catálogo Trazo.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {destination.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-mint-light px-2.5 py-1 text-[11px] font-medium text-forest"
            >
              {titleCase(tag)}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="text-xs text-muted">
            Desde{' '}
            <span className="text-sm font-bold text-forest">
              {destination.fromPrice ? formatMoneyShort(destination.fromPrice) : 'por definir'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-forest transition-transform group-hover:translate-x-0.5">
            Explorar <Icon name="arrowRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
};

const DestinationSkeleton: React.FC = () => (
  <div className="overflow-hidden rounded-[24px] border border-divider bg-white">
    <div className="h-44 animate-pulse bg-mint-light" />
    <div className="space-y-3 p-5">
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-divider" />
      <div className="h-3 w-3/5 animate-pulse rounded-full bg-divider" />
      <div className="h-8 w-2/5 animate-pulse rounded-full bg-divider" />
    </div>
  </div>
);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'ai' | 'human'>('ai');
  const [prompt, setPrompt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const destinationsQuery = useQuery({
    queryKey: ['catalog', 'destinations', 'featured'],
    queryFn: () => listDestinations({ featured: true, pageSize: 8 }),
    staleTime: 10 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createTripRequest,
    onSuccess: (tripRequest) => {
      navigate(`/workspace/${tripRequest.id}`);
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'No pudimos iniciar el viaje. Inténtalo de nuevo.'));
    },
  });

  useEffect(() => {
    const destination = searchParams.get('destination');
    const requestedMode = searchParams.get('mode');
    if (requestedMode === 'human') {
      navigate('/catalog', { replace: true });
      return;
    }
    if (destination) {
      setPrompt(`Quiero diseñar un viaje a ${destination}. `);
    }
    if (requestedMode === 'ia') {
      setMode('ai');
      window.setTimeout(() => {
        composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        textareaRef.current?.focus();
      }, 120);
    }
  }, [searchParams, navigate]);

  const chooseAi = () => {
    setMode('ai');
    window.setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textareaRef.current?.focus();
    }, 80);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = prompt.trim();
    if (clean.length < 3) {
      setFormError('Cuéntanos un poco más: destino, días o con quién viajas.');
      textareaRef.current?.focus();
      return;
    }
    setFormError(null);
    createMutation.mutate(clean);
  };

  const destinations = destinationsQuery.data?.items ?? [];
  const hero = destinations[0];
  const secondary = destinations[1];
  const heroImage = hero ? destinationImage(hero.slug, hero.heroImageUrl) : null;
  const secondaryImage = secondary
    ? destinationImage(secondary.slug, secondary.heroImageUrl)
    : null;

  return (
    <div className="overflow-x-hidden">
      {/* Hero editorial */}
      <section className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-mint/60 blur-3xl" />
          <div className="absolute right-[-8rem] top-40 h-80 w-80 rounded-full bg-gold/30 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-20 lg:pt-20">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-orange" aria-hidden="true" />
              Estudio de viajes · Colombia
            </p>

            <h1 className="mt-5 max-w-[15ch] font-heading text-[42px] font-extrabold leading-[0.98] tracking-tight text-forest sm:text-[58px] lg:text-[66px]">
              Viajar bien empieza con un{' '}
              <span className="relative inline-block">
                <span className="relative z-10">buen trazo.</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 300 18"
                  className="absolute -bottom-1.5 left-0 z-0 h-3 w-full text-orange"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M3 12C60 4 120 4 180 8s90 6 117 2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-muted sm:text-lg">
              Somos un equipo de asesores y diseñadores de viajes. Convertimos una idea suelta en
              un itinerario con hoteles, experiencias y presupuesto real, listo para compartir.
              <span className="font-medium text-forest"> Trazo es nuestra mesa de trabajo.</span>
            </p>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <Icon name="checkCircle" size={17} className="text-forest" /> Catálogo propio
              </span>
              <span className="inline-flex items-center gap-2">
                <Icon name="checkCircle" size={17} className="text-forest" /> Precios en COP
              </span>
              <span className="inline-flex items-center gap-2">
                <Icon name="checkCircle" size={17} className="text-forest" /> PDF con tu marca
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="cta" size="lg" onClick={chooseAi}>
                <Icon name="sparkles" size={18} />
                Diseñar con IA
              </Button>
              <Link
                to="/catalog"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-border bg-transparent px-6 text-base font-bold text-forest transition-colors hover:border-forest hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
              >
                <Icon name="compass" size={18} />
                Ver destinos
              </Link>
            </div>
          </div>

          {/* Postcard composition */}
          <div className="relative mx-auto w-full max-w-[510px] animate-rise-delayed">
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-10 hidden h-32 w-32 rounded-full border border-forest/10 sm:block"
            />
            <div className="relative rotate-[-2deg] rounded-[30px] border border-white/80 bg-white p-3 shadow-[0_30px_60px_-30px_rgba(16,38,42,0.45)] transition-transform duration-500 hover:rotate-0">
              <div className="relative h-[300px] overflow-hidden rounded-[22px] bg-mint sm:h-[340px]">
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt={`Imagen de ${hero?.city ?? 'destino'}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#CFEAE3,#9ADBCB)] text-forest/40">
                    <Icon name="map" size={72} strokeWidth={1.2} />
                  </div>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,42,0.02)_30%,rgba(16,38,42,0.82))]" />
                <span className="absolute right-4 top-4 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-bold text-forest backdrop-blur">
                  {hero?.fromPrice ? `Desde ${formatMoneyShort(hero.fromPrice)}` : 'Colombia'}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                    Destino curado
                  </p>
                  <p className="font-heading text-[32px] font-extrabold leading-tight">
                    {hero?.city ?? 'Colombia'}
                  </p>
                  <p className="mt-1 line-clamp-2 max-w-[36ch] text-sm leading-snug text-white/80">
                    {hero?.description ?? 'Historia, naturaleza y mesa compartida.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Small second postcard */}
            <div className="absolute -bottom-8 -left-3 hidden w-[220px] rotate-[3deg] overflow-hidden rounded-[22px] border border-white bg-sand p-2 shadow-[0_20px_40px_-22px_rgba(16,38,42,0.5)] sm:block">
              <div className="relative h-[92px] overflow-hidden rounded-[16px] bg-mint">
                {secondaryImage ? (
                  <img
                    src={secondaryImage}
                    alt={`Imagen de ${secondary?.city ?? 'destino'}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gold/50">
                    <Icon name="sun" size={30} />
                  </div>
                )}
                <div className="absolute inset-0 bg-forest/25" />
              </div>
              <div className="flex items-center justify-between px-2 pb-1 pt-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Siguiente parada
                  </p>
                  <p className="font-heading text-base font-bold leading-tight">
                    {secondary?.city ?? 'Guatapé'}
                  </p>
                </div>
                <Icon name="route" size={20} className="text-orange" />
              </div>
            </div>

            <div className="absolute -right-2 bottom-10 hidden rotate-[4deg] rounded-2xl border border-forest/15 bg-gold px-4 py-3 shadow-sm sm:block">
              <p className="font-heading text-2xl font-extrabold leading-none">100%</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-forest/70">
                Hecho a mano
              </p>
            </div>

            <svg
              aria-hidden="true"
              viewBox="0 0 160 120"
              className="absolute -right-10 -top-8 hidden h-28 w-40 text-forest/25 sm:block"
            >
              <path
                d="M8 100C50 100 30 20 80 20s40 70 72 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="2 8"
                strokeLinecap="round"
              />
              <circle cx="8" cy="100" r="4" fill="#FF6B3D" />
              <circle cx="152" cy="40" r="5" fill="#9ADBCB" />
            </svg>
          </div>
        </div>
      </section>

      {/* Mode chooser */}
      <section aria-labelledby="modos-title" className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-divider bg-white p-5 shadow-[0_20px_40px_-32px_rgba(16,38,42,0.3)] sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Elige tu camino
              </p>
              <h2 id="modos-title" className="mt-1 font-heading text-2xl font-extrabold sm:text-3xl">
                ¿Cómo quieres empezar?
              </h2>
            </div>
            <p className="max-w-[38ch] text-sm text-muted">
              Las dos puertas llevan al mismo lugar: un viaje con tu criterio.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              aria-pressed={mode === 'ai'}
              onClick={chooseAi}
              className={`group flex cursor-pointer items-start gap-4 rounded-[24px] border-[1.5px] p-5 text-left transition-all focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3 ${
                mode === 'ai'
                  ? 'border-forest bg-forest text-white shadow-[0_18px_30px_-22px_rgba(16,38,42,0.7)]'
                  : 'border-border bg-sand text-forest hover:-translate-y-0.5 hover:border-forest/40 hover:bg-mint-light'
              }`}
            >
              <span
                className={`grid h-12 w-12 flex-none place-items-center rounded-2xl ${
                  mode === 'ai' ? 'bg-orange text-white' : 'bg-mint text-forest'
                }`}
              >
                <Icon name="sparkles" size={24} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-heading text-lg font-extrabold leading-tight">
                  Uso acompañado de IA
                  {mode === 'ai' ? (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      Activo
                    </span>
                  ) : null}
                </span>
                <span
                  className={`mt-1 block text-sm leading-relaxed ${
                    mode === 'ai' ? 'text-white/75' : 'text-muted'
                  }`}
                >
                  Cuéntanos el viaje en una frase. Trazo propone el itinerario y tú decides cada
                  detalle.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold">
                  Escribir el viaje <Icon name="arrowRight" size={14} />
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="group flex cursor-pointer items-start gap-4 rounded-[24px] border-[1.5px] border-border bg-sand p-5 text-left text-forest transition-all hover:-translate-y-0.5 hover:border-forest/40 hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
            >
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-gold text-forest">
                <Icon name="compass" size={24} />
              </span>
              <span className="min-w-0">
                <span className="font-heading text-lg font-extrabold leading-tight">
                  Experiencia persona
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  Prefieres mirar el catálogo con calma, comparar hoteles y elegir a tu ritmo.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold">
                  Explorar destinos <Icon name="arrowRight" size={14} />
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* AI composer */}
      {mode === 'ai' ? (
        <section
          ref={composerRef}
          aria-labelledby="composer-title"
          className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="relative overflow-hidden rounded-[32px] border border-forest/10 bg-forest p-6 text-white shadow-[0_30px_60px_-30px_rgba(16,38,42,0.65)] sm:p-9">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-teal/10 blur-2xl"
            />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_260px]">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal">
                  <Icon name="sparkles" size={14} /> Super prompt
                </p>
                <h2
                  id="composer-title"
                  className="mt-2 max-w-[20ch] font-heading text-3xl font-extrabold leading-[1.02] sm:text-[40px]"
                >
                  Escribe el viaje. Nosotros lo trazamos.
                </h2>
                <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-white/70">
                  Menciona destino, días, viajeros y lo que no puede faltar. Si algo queda suelto,
                  Trazo te hará máximo dos preguntas antes de generar el plan.
                </p>

                <form onSubmit={submit} className="mt-6">
                  <label htmlFor="trip-prompt" className="sr-only">
                    Describe el viaje
                  </label>
                  <div className="rounded-[26px] bg-white p-2 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
                    <textarea
                      id="trip-prompt"
                      ref={textareaRef}
                      value={prompt}
                      onChange={(event) => {
                        setPrompt(event.target.value.slice(0, 2000));
                        if (formError) setFormError(null);
                      }}
                      rows={3}
                      placeholder="Ej. Quiero cinco días en Cartagena para dos personas, con playa, historia y buena comida."
                      className="block w-full resize-none rounded-[20px] border-0 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-forest placeholder:text-muted/55 focus-visible:outline-none"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-1">
                      <span className="text-[11px] font-medium text-muted">
                        {prompt.length}/2000 · Sin datos personales
                      </span>
                      <Button type="submit" variant="cta" size="md" isLoading={createMutation.isPending}>
                        <Icon name="sparkles" size={16} />
                        {createMutation.isPending ? 'Preparando…' : 'Trazar mi viaje'}
                      </Button>
                    </div>
                  </div>
                  {formError ? (
                    <p role="alert" className="mt-2 text-sm font-medium text-gold">
                      {formError}
                    </p>
                  ) : null}
                </form>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
                    Prueba con
                  </span>
                  {promptExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setPrompt(example);
                        setFormError(null);
                        textareaRef.current?.focus();
                      }}
                      className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-left text-xs text-white/80 transition-colors hover:border-white/40 hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-orange"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <aside className="hidden flex-col justify-between rounded-[24px] border border-white/10 bg-white/5 p-5 lg:flex">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    Lo que obtienes
                  </p>
                  <ul className="mt-3 space-y-3 text-sm text-white/80">
                    <li className="flex items-start gap-2">
                      <Icon name="calendar" size={16} className="mt-0.5 flex-none text-teal" />
                      Itinerario día por día
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="hotel" size={16} className="mt-0.5 flex-none text-gold" />
                      Hoteles y experiencias del catálogo
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="wallet" size={16} className="mt-0.5 flex-none text-orange" />
                      Presupuesto con margen privado
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="download" size={16} className="mt-0.5 flex-none text-teal" />
                      PDF de marca para el cliente
                    </li>
                  </ul>
                </div>
                <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/45">
                  La IA no inventa precios: todo se recalcula desde el catálogo de la agencia.
                </p>
              </aside>
            </div>
          </div>
        </section>
      ) : null}

      {/* Featured destinations */}
      <section aria-labelledby="destinos-title" className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              Catálogo Trazo
            </p>
            <h2 id="destinos-title" className="mt-1 font-heading text-3xl font-extrabold sm:text-4xl">
              Destinos para ti
            </h2>
            <p className="mt-2 max-w-[52ch] text-sm text-muted">
              Siete lugares de Colombia, elegidos por lo que se puede vivir en ellos. Entra a
              cualquiera para ver hoteles, actividades y transporte.
            </p>
          </div>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-border px-4 py-2.5 text-sm font-bold text-forest transition-colors hover:border-forest hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
          >
            Ver catálogo completo <Icon name="arrowRight" size={15} />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {destinationsQuery.isLoading
            ? Array.from({ length: 4 }, (_, index) => <DestinationSkeleton key={index} />)
            : destinations.slice(0, 4).map((destination) => (
                <DestinationCard key={destination.id} destination={destination} />
              ))}
        </div>

        {destinationsQuery.isError ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-dark/25 bg-orange-dark/5 px-4 py-3 text-sm text-orange-dark">
            <span>No pudimos cargar los destinos destacados.</span>
            <button
              type="button"
              onClick={() => void destinationsQuery.refetch()}
              className="cursor-pointer rounded-full border border-orange-dark/40 px-3 py-1.5 text-xs font-bold"
            >
              Reintentar
            </button>
          </div>
        ) : null}
      </section>

      {/* How it works */}
      <section aria-labelledby="como-title" className="border-y border-divider bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Cómo funciona
              </p>
              <h2 id="como-title" className="mt-1 font-heading text-3xl font-extrabold sm:text-4xl">
                De la frase al plan, sin hojas de cálculo.
              </h2>
            </div>
            <p className="max-w-[36ch] text-sm text-muted">
              El asesor sigue siendo el autor. La IA solo se encarga del trabajo repetitivo.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative rounded-[24px] border border-divider bg-sand p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-forest">
                    <Icon name={step.icon} size={21} />
                  </span>
                  <span className="font-heading text-2xl font-extrabold text-border">{step.number}</span>
                </div>
                <h3 className="mt-5 font-heading text-xl font-extrabold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] bg-mint px-6 py-10 sm:px-10 sm:py-12">
          <svg
            aria-hidden="true"
            viewBox="0 0 400 200"
            className="pointer-events-none absolute -right-6 -top-6 h-56 w-72 text-forest/15"
          >
            <path
              d="M10 170C80 170 60 30 150 30s90 120 190 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="3 10"
              strokeLinecap="round"
            />
            <circle cx="10" cy="170" r="6" fill="#FF6B3D" />
            <circle cx="340" cy="60" r="8" fill="#10262A" opacity=".5" />
          </svg>
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-[52ch]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest/60">
                Siguiente parada
              </p>
              <h2 className="mt-1 font-heading text-3xl font-extrabold leading-tight sm:text-[40px]">
                ¿Trazamos el próximo viaje?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-forest/70">
                Empieza con una idea o recorre el catálogo. En cualquiera de los dos caminos, el
                plan sale con precios reales y tu criterio.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="lg" onClick={chooseAi}>
                <Icon name="sparkles" size={18} /> Diseñar con IA
              </Button>
              <Link
                to="/catalog"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-forest/30 bg-transparent px-6 text-base font-bold text-forest transition-colors hover:border-forest hover:bg-white/40 focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
              >
                <Icon name="compass" size={18} /> Explorar catálogo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-divider bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo size={26} />
            <span className="text-xs text-muted">Estudio de viajes · Medellín, Colombia</span>
          </div>
          <p className="text-xs text-muted">
            Fotografías de referencia de los destinos · Proyecto académico 2026
          </p>
        </div>
      </footer>
    </div>
  );
};
