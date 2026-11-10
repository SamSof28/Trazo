import React, { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanDto, PlanStatus } from '@trazo/shared';
import { listDestinations } from '../../shared/api/catalog';
import { errorMessage } from '../../shared/api/client';
import { downloadPlanPdf, duplicatePlan, listPlans } from '../../shared/api/plans';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { toast } from '../../shared/components/Toast';
import { useAuthStore } from '../auth/store';
import {
  dateRangeFromDays,
  formatDateRange,
  formatDateTime,
  formatMoney,
  statusLabel,
  statusVariant,
  titleCase,
} from '../../shared/lib/format';
import { destinationImage } from '../../shared/lib/images';

type StatusFilter = 'ALL' | PlanStatus;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'SAVED', label: 'Guardados' },
  { value: 'PUBLISHED', label: 'Publicados' },
  { value: 'ARCHIVED', label: 'Archivados' },
];

const PAGE_SIZE = 9;

function usePlanCount(status: PlanStatus) {
  return useQuery({
    queryKey: ['plans', 'count', status],
    queryFn: () => listPlans({ status, pageSize: 1 }),
    select: (data) => data.total,
  });
}

const StatCard: React.FC<{
  label: string;
  value: number | undefined;
  icon: 'grid' | 'edit' | 'checkCircle' | 'lock';
  tone: string;
}> = ({ label, value, icon, tone }) => (
  <div className="flex items-center gap-3 rounded-[20px] border border-divider bg-white px-4 py-3.5">
    <span className={`grid h-10 w-10 flex-none place-items-center rounded-[13px] ${tone}`}>
      <Icon name={icon} size={18} />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="font-heading text-xl font-extrabold leading-tight">
        {value === undefined ? <span className="inline-block h-5 w-8 animate-pulse rounded-full bg-divider" /> : value}
      </p>
    </div>
  </div>
);

const PlanCard: React.FC<{
  plan: PlanDto;
  onDuplicate: (plan: PlanDto) => void;
  onDownload: (plan: PlanDto) => void;
  duplicating: boolean;
  downloading: boolean;
}> = ({ plan, onDuplicate, onDownload, duplicating, downloading }) => {
  const range = dateRangeFromDays(plan.days);
  const title = plan.title ?? `${plan.destination.city} · ${plan.days.length} días`;
  const image = destinationImage(
    plan.destination.slug,
    plan.heroImageUrl ?? plan.destination.heroImageUrl,
  );

  return (
    <article className="group flex flex-col overflow-hidden rounded-[24px] border border-divider bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_46px_-26px_rgba(16,38,42,0.35)]">
      <Link
        to={`/plans/${plan.id}`}
        className="relative block h-40 overflow-hidden bg-mint focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
        aria-label={`Abrir ${title}`}
      >
        {image ? (
          <img
            src={image}
            alt={`Imagen de ${plan.destination.city}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#10262A,#3F575B)] text-white/25">
            <Icon name="route" size={48} strokeWidth={1.3} />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,42,0.06)_40%,rgba(16,38,42,0.55))]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <Badge variant={statusVariant(plan.status)}>{statusLabel(plan.status)}</Badge>
          <span className="rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-forest backdrop-blur">
            {plan.days.length} {plan.days.length === 1 ? 'día' : 'días'}
          </span>
        </div>
        <p className="absolute inset-x-0 bottom-0 p-4 text-xs font-bold uppercase tracking-[0.14em] text-white/80">
          {plan.destination.city}, {plan.destination.country}
        </p>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <Link
          to={`/plans/${plan.id}`}
          className="font-heading text-[21px] font-extrabold leading-tight transition-colors hover:text-orange-dark focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
        >
          {title}
        </Link>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
          <Icon name="calendar" size={14} className="flex-none" />
          {formatDateRange(range.start, range.end)}
        </p>
        {plan.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{plan.summary}</p>
        ) : null}
        {plan.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plan.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-mint-light px-2.5 py-1 text-[11px] font-medium text-forest"
              >
                {titleCase(tag)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-divider pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Total con margen</p>
            <p className="font-heading text-lg font-extrabold leading-tight">
              {formatMoney(plan.budget.total)}
            </p>
          </div>
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              onClick={() => onDuplicate(plan)}
              disabled={duplicating || downloading}
              aria-label={`Duplicar ${title}`}
              title="Duplicar plan"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-border bg-white text-forest transition-colors hover:border-teal hover:bg-mint-light disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-orange"
            >
              <Icon name={duplicating ? 'loader' : 'copy'} size={16} className={duplicating ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => onDownload(plan)}
              disabled={duplicating || downloading}
              aria-label={`Descargar PDF de ${title}`}
              title="Descargar PDF"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-border bg-white text-forest transition-colors hover:border-teal hover:bg-mint-light disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-orange"
            >
              <Icon name={downloading ? 'loader' : 'download'} size={16} className={downloading ? 'animate-spin' : ''} />
            </button>
            <Link
              to={`/plans/${plan.id}`}
              aria-label={`Abrir ${title}`}
              title="Abrir plan"
              className="grid h-9 w-9 place-items-center rounded-full bg-forest text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_0_#FF6B3D] focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            >
              <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-muted/70">
          Actualizado {formatDateTime(plan.updatedAt)}
          {plan.version > 1 ? ` · v${plan.version}` : ''}
        </p>
      </div>
    </article>
  );
};

const PlanSkeleton: React.FC = () => (
  <div className="overflow-hidden rounded-[24px] border border-divider bg-white">
    <div className="h-40 animate-pulse bg-mint-light" />
    <div className="space-y-3 p-5">
      <div className="h-4 w-4/5 animate-pulse rounded-full bg-divider" />
      <div className="h-3 w-3/5 animate-pulse rounded-full bg-divider" />
      <div className="h-3 w-full animate-pulse rounded-full bg-divider" />
      <div className="h-10 w-2/5 animate-pulse rounded-full bg-divider" />
    </div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const destinationsQuery = useQuery({
    queryKey: ['catalog', 'destinations', 'options'],
    queryFn: () => listDestinations({ pageSize: 50 }),
  });

  const plansQuery = useQuery({
    queryKey: ['plans', 'list', status, deferredSearch, destinationId, page],
    queryFn: () =>
      listPlans({
        status: status === 'ALL' ? undefined : status,
        q: deferredSearch || undefined,
        destinationId: destinationId || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const draftCount = usePlanCount('DRAFT');
  const savedCount = usePlanCount('SAVED');
  const publishedCount = usePlanCount('PUBLISHED');
  const archivedCount = usePlanCount('ARCHIVED');

  const counts = useMemo(
    () => ({
      editing: (draftCount.data ?? 0) + (savedCount.data ?? 0),
      published: publishedCount.data,
      archived: archivedCount.data,
      total:
        draftCount.data !== undefined &&
        savedCount.data !== undefined &&
        publishedCount.data !== undefined &&
        archivedCount.data !== undefined
          ? draftCount.data + savedCount.data + publishedCount.data + archivedCount.data
          : undefined,
    }),
    [draftCount.data, savedCount.data, publishedCount.data, archivedCount.data],
  );

  const duplicateMutation = useMutation({
    mutationFn: (plan: PlanDto) => duplicatePlan(plan.id),
    onSuccess: (plan) => {
      toast.success('Duplicamos el plan. Ya puedes editarlo.');
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      navigate(`/plans/${plan.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const pdfMutation = useMutation({
    mutationFn: (plan: PlanDto) => downloadPlanPdf(plan.id),
    onSuccess: () => toast.success('PDF descargado.'),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const plans = plansQuery.data?.items ?? [];
  const total = plansQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = status !== 'ALL' || deferredSearch.length > 0 || destinationId.length > 0;

  const resetFilters = () => {
    setStatus('ALL');
    setSearch('');
    setDestinationId('');
    setPage(1);
  };

  const firstName = user?.name.split(/\s+/)[0] ?? 'asesor';

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-dark">
            Panel de asesor
          </p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold leading-none sm:text-5xl">
            Hola, {firstName}
          </h1>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">
            Tus viajes, borradores y publicaciones en un solo lugar. Retoma donde lo dejaste o
            empieza uno nuevo en segundos.
          </p>
        </div>
        <Button variant="cta" onClick={() => navigate('/?mode=ia')}>
          <Icon name="sparkles" size={17} /> Diseñar un viaje
        </Button>
      </header>

      <section
        aria-label="Resumen de planes"
        className="animate-rise-delayed mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard label="Planes totales" value={counts.total} icon="grid" tone="bg-mint-light text-forest" />
        <StatCard label="En edición" value={counts.editing} icon="edit" tone="bg-gold/40 text-forest" />
        <StatCard label="Publicados" value={counts.published} icon="checkCircle" tone="bg-teal text-forest" />
        <StatCard label="Archivados" value={counts.archived} icon="lock" tone="bg-divider text-muted" />
      </section>

      <section aria-label="Filtros" className="mt-8 rounded-[24px] border border-divider bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar planes</span>
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por título, destino o resumen…"
              className="min-h-[46px] w-full rounded-full border border-border bg-sand pl-11 pr-4 text-sm text-forest outline-none transition-colors placeholder:text-muted/70 focus:border-teal focus:bg-white"
            />
          </label>

          <label className="relative">
            <span className="sr-only">Filtrar por destino</span>
            <select
              value={destinationId}
              onChange={(event) => {
                setDestinationId(event.target.value);
                setPage(1);
              }}
              className="min-h-[46px] w-full cursor-pointer appearance-none rounded-full border border-border bg-sand py-0 pl-4 pr-10 text-sm font-medium text-forest outline-none transition-colors focus:border-teal focus:bg-white lg:w-56"
            >
              <option value="">Todos los destinos</option>
              {(destinationsQuery.data?.items ?? []).map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.city}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              size={16}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {statusFilters.map((filter) => {
            const active = status === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
                className={`min-h-[34px] cursor-pointer rounded-full px-3.5 text-xs font-bold transition-colors focus-visible:outline-3 focus-visible:outline-orange ${
                  active
                    ? 'bg-forest text-white'
                    : 'bg-sand text-muted hover:bg-mint-light hover:text-forest'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-bold text-orange-dark transition-colors hover:bg-orange-dark/10 focus-visible:outline-3 focus-visible:outline-orange"
            >
              <Icon name="close" size={13} /> Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {plansQuery.isLoading ? (
            'Cargando planes…'
          ) : (
            <>
              <span className="font-bold text-forest">{total}</span>{' '}
              {total === 1 ? 'plan' : 'planes'}
              {hasFilters ? ' con estos filtros' : ''}
            </>
          )}
        </p>
        {plansQuery.isFetching && !plansQuery.isLoading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Icon name="loader" size={14} className="animate-spin" /> Actualizando
          </span>
        ) : null}
      </div>

      {plansQuery.isError ? (
        <div className="mt-4 rounded-[24px] border border-orange-dark/25 bg-white p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange/15 text-orange-dark">
            <Icon name="alert" size={22} />
          </span>
          <h2 className="mt-3 font-heading text-xl font-extrabold">No pudimos cargar tus planes</h2>
          <p className="mt-1 text-sm text-muted">{errorMessage(plansQuery.error)}</p>
          <Button className="mt-4" variant="outline" onClick={() => void plansQuery.refetch()}>
            <Icon name="refresh" size={16} /> Reintentar
          </Button>
        </div>
      ) : plansQuery.isLoading ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <PlanSkeleton key={index} />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-[28px] border border-divider bg-white">
          <div className="relative px-6 py-14 text-center sm:px-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(154,219,203,0.35),transparent_62%)]" />
            <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-forest text-white">
              <Icon name="route" size={28} strokeWidth={1.5} />
            </span>
            <h2 className="relative mt-4 font-heading text-2xl font-extrabold sm:text-3xl">
              {hasFilters ? 'Ningún plan coincide' : 'Tu primer viaje empieza aquí'}
            </h2>
            <p className="relative mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-muted">
              {hasFilters
                ? 'Prueba con otro estado, destino o palabra clave.'
                : 'Cuéntanos a dónde quieres ir y Trazo arma un itinerario editable con hoteles, actividades y presupuesto.'}
            </p>
            <div className="relative mt-5 flex flex-wrap justify-center gap-2">
              {hasFilters ? (
                <Button variant="outline" onClick={resetFilters}>
                  <Icon name="close" size={16} /> Limpiar filtros
                </Button>
              ) : null}
              <Button variant="cta" onClick={() => navigate('/?mode=ia')}>
                <Icon name="sparkles" size={17} /> Diseñar un viaje
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onDuplicate={(target) => duplicateMutation.mutate(target)}
              onDownload={(target) => pdfMutation.mutate(target)}
              duplicating={duplicateMutation.isPending && duplicateMutation.variables?.id === plan.id}
              downloading={pdfMutation.isPending && pdfMutation.variables?.id === plan.id}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Paginación de planes" className="mt-8 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || plansQuery.isFetching}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-white px-4 text-sm font-bold text-forest transition-colors hover:border-forest hover:bg-mint-light disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="chevronLeft" size={16} /> Anterior
          </button>
          <span className="px-2 text-sm text-muted">
            Página <span className="font-bold text-forest">{page}</span> de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || plansQuery.isFetching}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-white px-4 text-sm font-bold text-forest transition-colors hover:border-forest hover:bg-mint-light disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-orange"
          >
            Siguiente <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      ) : null}
    </div>
  );
};
