import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddPlanItemInput,
  PlanDto,
  PlanItemDto,
  PlanItemType,
  UpdatePlanInput,
} from '@trazo/shared';
import {
  addPlanItem,
  archivePlan,
  downloadPlanCsv,
  downloadPlanPdf,
  duplicatePlan,
  getPlan,
  listPlanAlternatives,
  movePlanItem,
  publishPlan,
  removePlanItem,
  replacePlanItem,
  savePlan,
  updatePlan,
  updatePlanItem,
} from '../../shared/api/plans';
import { listActivities, listHotels, listTransport } from '../../shared/api/catalog';
import { errorMessage } from '../../shared/api/client';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import type { IconName } from '../../shared/components/Icon';
import { Modal } from '../../shared/components/Modal';
import { toast } from '../../shared/components/Toast';
import {
  dateRangeFromDays,
  formatDate,
  formatDateShort,
  formatMoney,
  percentLabel,
  pricingUnitLabel,
  statusLabel,
  statusVariant,
  titleCase,
  transportModeLabel,
  typeLabel,
} from '../../shared/lib/format';

type ConfirmAction = 'publish' | 'archive' | 'duplicate';
type AddType = PlanItemType;

const typeIcon: Record<PlanItemType, IconName> = {
  ACCOMMODATION: 'hotel',
  ACTIVITY: 'activity',
  TRANSPORT: 'plane',
};

const typeSurface: Record<PlanItemType, string> = {
  ACCOMMODATION: 'bg-gold/30 text-forest',
  ACTIVITY: 'bg-orange/15 text-orange-dark',
  TRANSPORT: 'bg-mint text-forest',
};

function planTitle(plan: PlanDto): string {
  return plan.title ?? `${plan.destination.city} · ${plan.days.length} días`;
}

function itemTime(item: PlanItemDto): string {
  if (item.startTime && item.endTime) return `${item.startTime} – ${item.endTime}`;
  if (item.startTime) return `Desde ${item.startTime}`;
  return 'Sin horario';
}

function quantityLabel(item: PlanItemDto): string {
  return `×${item.quantity} · ${pricingUnitLabel(item.pricingUnit)}`;
}

const ItemCard: React.FC<{
  item: PlanItemDto;
  readOnly: boolean;
  onChange: () => void;
  onEdit: () => void;
  onMove: () => void;
  onRemove: () => void;
}> = ({ item, readOnly, onChange, onEdit, onMove, onRemove }) => (
  <article className="group flex gap-3 rounded-[18px] border border-divider bg-white p-4 transition-shadow hover:shadow-[0_12px_28px_-20px_rgba(16,38,42,0.35)] sm:gap-4">
    <span
      className={`grid h-11 w-11 flex-none place-items-center rounded-[14px] ${typeSurface[item.type]}`}
    >
      <Icon name={typeIcon[item.type]} size={21} />
    </span>

    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {typeLabel(item.type)} · {itemTime(item)}
          </p>
          <h3 className="mt-0.5 font-heading text-[17px] font-extrabold leading-tight">
            {item.name}
          </h3>
          {item.notes ? <p className="mt-1 text-xs leading-relaxed text-muted">{item.notes}</p> : null}
        </div>
        <div className="flex-none text-right">
          <p className="font-heading text-lg font-extrabold leading-none">{formatMoney(item.subtotal)}</p>
          <p className="mt-1 text-[11px] text-muted">
            {formatMoney(item.unitPrice)} · {quantityLabel(item)}
          </p>
        </div>
      </div>

      {!readOnly ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onChange}
            className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-full border border-border bg-white px-2.5 text-[11px] font-bold text-forest transition-colors hover:border-teal hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="swap" size={12} /> Cambiar
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-full border border-border bg-white px-2.5 text-[11px] font-bold text-forest transition-colors hover:border-teal hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="edit" size={12} /> Editar
          </button>
          <button
            type="button"
            onClick={onMove}
            className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-full border border-border bg-white px-2.5 text-[11px] font-bold text-forest transition-colors hover:border-teal hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="calendar" size={12} /> Mover
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-full border border-orange-dark/30 bg-white px-2.5 text-[11px] font-bold text-orange-dark transition-colors hover:bg-orange-dark/5 focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="trash" size={12} /> Quitar
          </button>
        </div>
      ) : null}
    </div>
  </article>
);

export const WorkspacePlanPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const planQuery = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => getPlan(planId as string),
    enabled: Boolean(planId),
  });

  const plan = planQuery.data;
  const readOnly = plan?.status === 'PUBLISHED' || plan?.status === 'ARCHIVED';

  const [activeDayNumber, setActiveDayNumber] = useState(1);
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaSummary, setMetaSummary] = useState('');
  const [metaTags, setMetaTags] = useState('');
  const [marginDraft, setMarginDraft] = useState(0);
  const [alternativesItem, setAlternativesItem] = useState<PlanItemDto | null>(null);
  const [detailsItem, setDetailsItem] = useState<PlanItemDto | null>(null);
  const [moveTarget, setMoveTarget] = useState<PlanItemDto | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PlanItemDto | null>(null);
  const [moveDay, setMoveDay] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<AddType>('ACTIVITY');
  const [addDay, setAddDay] = useState(1);
  const [addSearch, setAddSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);
  const [detailsForm, setDetailsForm] = useState({
    quantity: 1,
    startTime: '',
    endTime: '',
    notes: '',
  });

  const applyPlan = (updated: PlanDto) => {
    queryClient.setQueryData(['plan', planId], updated);
  };

  useEffect(() => {
    if (!plan) return;
    setMarginDraft(plan.budget.marginPercent);
    setActiveDayNumber((current) =>
      plan.days.some((day) => day.dayNumber === current) ? current : (plan.days[0]?.dayNumber ?? 1),
    );
  }, [plan]);

  useEffect(() => {
    if (!detailsItem) return;
    setDetailsForm({
      quantity: detailsItem.quantity,
      startTime: detailsItem.startTime ?? '',
      endTime: detailsItem.endTime ?? '',
      notes: detailsItem.notes ?? '',
    });
  }, [detailsItem]);

  const alternativesQuery = useQuery({
    queryKey: ['plan', planId, 'alternatives', alternativesItem?.id],
    queryFn: () => listPlanAlternatives(planId as string, alternativesItem!.id),
    enabled: Boolean(planId && alternativesItem),
  });

  const hotelsQuery = useQuery({
    queryKey: ['catalog', 'hotels', plan?.destination.id],
    queryFn: () => listHotels(plan!.destination.id),
    enabled: addOpen && Boolean(plan?.destination.id),
  });

  const activitiesQuery = useQuery({
    queryKey: ['catalog', 'activities', plan?.destination.id],
    queryFn: () => listActivities(plan!.destination.id),
    enabled: addOpen && Boolean(plan?.destination.id),
  });

  const transportQuery = useQuery({
    queryKey: ['catalog', 'transport', plan?.destination.id],
    queryFn: () => listTransport(plan!.destination.id),
    enabled: addOpen && Boolean(plan?.destination.id),
  });

  const metaMutation = useMutation({
    mutationFn: (input: UpdatePlanInput) => updatePlan(planId as string, input),
    onSuccess: (updated) => {
      applyPlan(updated);
      setMetaOpen(false);
      toast.success('Título, resumen y etiquetas actualizados.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos guardar los cambios.')),
  });

  const marginMutation = useMutation({
    mutationFn: (marginPercent: number) => updatePlan(planId as string, { marginPercent }),
    onSuccess: applyPlan,
    onError: (error) => toast.error(errorMessage(error, 'No pudimos actualizar el margen.')),
  });

  const saveMutation = useMutation({
    mutationFn: () => savePlan(planId as string),
    onSuccess: (updated) => {
      applyPlan(updated);
      toast.success('Plan guardado. Ya puedes publicarlo o seguir editándolo.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos guardar el plan.')),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishPlan(planId as string),
    onSuccess: (updated) => {
      applyPlan(updated);
      setConfirmAction(null);
      toast.success('Plan publicado. Ahora es de solo lectura.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos publicar el plan.')),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archivePlan(planId as string),
    onSuccess: (updated) => {
      applyPlan(updated);
      setConfirmAction(null);
      toast.success('Plan archivado. Puedes duplicarlo si necesitas retomarlo.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos archivar el plan.')),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicatePlan(planId as string),
    onSuccess: (created) => {
      setConfirmAction(null);
      toast.success('Copia creada como nuevo borrador.');
      navigate(`/plans/${created.id}`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos duplicar el plan.')),
  });

  const addMutation = useMutation({
    mutationFn: (input: AddPlanItemInput) => addPlanItem(planId as string, input),
    onSuccess: (updated) => {
      applyPlan(updated);
      setAddOpen(false);
      toast.success('Ítem agregado al itinerario.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos agregar el ítem.')),
  });

  const replaceMutation = useMutation({
    mutationFn: (catalogItemId: string) =>
      replacePlanItem(planId as string, alternativesItem!.id, { catalogItemId }),
    onSuccess: (updated) => {
      applyPlan(updated);
      setAlternativesItem(null);
      toast.success('Ítem reemplazado. El presupuesto se recalculó.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos reemplazar el ítem.')),
  });

  const detailsMutation = useMutation({
    mutationFn: () =>
      updatePlanItem(planId as string, detailsItem!.id, {
        quantity: detailsForm.quantity,
        startTime: detailsForm.startTime || null,
        endTime: detailsForm.endTime || null,
        notes: detailsForm.notes.trim() || null,
      }),
    onSuccess: (updated) => {
      applyPlan(updated);
      setDetailsItem(null);
      toast.success('Detalles del ítem actualizados.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos actualizar el ítem.')),
  });

  const moveMutation = useMutation({
    mutationFn: () => movePlanItem(planId as string, moveTarget!.id, { dayNumber: moveDay }),
    onSuccess: (updated) => {
      applyPlan(updated);
      setMoveTarget(null);
      toast.success('Ítem movido de día.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos mover el ítem.')),
  });

  const removeMutation = useMutation({
    mutationFn: () => removePlanItem(planId as string, removeTarget!.id),
    onSuccess: (updated) => {
      applyPlan(updated);
      setRemoveTarget(null);
      toast.success('Ítem quitado del plan.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No pudimos quitar el ítem.')),
  });

  const openMeta = () => {
    if (!plan) return;
    setMetaTitle(plan.title ?? '');
    setMetaSummary(plan.summary ?? '');
    setMetaTags(plan.tags.join(', '));
    setMetaOpen(true);
  };

  const openAdd = () => {
    setAddType('ACTIVITY');
    setAddDay(activeDayNumber);
    setAddSearch('');
    setAddOpen(true);
  };

  const openMove = (item: PlanItemDto) => {
    const day = plan?.days.find((candidate) => candidate.items.some((entry) => entry.id === item.id));
    setMoveDay(day?.dayNumber ?? activeDayNumber);
    setMoveTarget(item);
  };

  const submitMeta = (event: React.FormEvent) => {
    event.preventDefault();
    metaMutation.mutate({
      title: metaTitle.trim() || null,
      summary: metaSummary.trim() || null,
      tags: metaTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    });
  };

  const commitMargin = () => {
    if (!plan || readOnly) return;
    if (Math.abs(marginDraft - plan.budget.marginPercent) < 0.001) return;
    marginMutation.mutate(marginDraft);
  };

  const handleDownload = async (kind: 'pdf' | 'csv') => {
    if (!plan) return;
    setDownloading(kind);
    try {
      if (kind === 'pdf') await downloadPlanPdf(plan.id);
      else await downloadPlanCsv(plan.id);
      toast.success(kind === 'pdf' ? 'PDF descargado.' : 'CSV descargado.');
    } catch (error) {
      toast.error(errorMessage(error, 'No pudimos descargar el archivo.'));
    } finally {
      setDownloading(null);
    }
  };

  const activeDay = useMemo(
    () => plan?.days.find((day) => day.dayNumber === activeDayNumber) ?? plan?.days[0],
    [plan, activeDayNumber],
  );

  const addOptions = useMemo(() => {
    if (!plan) return [];
    if (addType === 'ACCOMMODATION') {
      return (hotelsQuery.data?.items ?? []).map((hotel) => ({
        id: hotel.id,
        name: hotel.name,
        price: hotel.pricePerNight,
        meta: `${hotel.category} estrellas · ${hotel.roomType}`,
        tags: [] as string[],
        unit: 'por noche',
      }));
    }
    if (addType === 'ACTIVITY') {
      return (activitiesQuery.data?.items ?? []).map((activity) => ({
        id: activity.id,
        name: activity.name,
        price: activity.pricePerPerson,
        meta: `${activity.durationMinutes} min · intensidad ${activity.intensity.toLowerCase()}`,
        tags: activity.tags,
        unit: 'por persona',
      }));
    }
    return (transportQuery.data?.items ?? []).map((option) => ({
      id: option.id,
      name: `${option.provider} · ${transportModeLabel(option.mode)}`,
      price: option.price,
      meta: `${option.durationMinutes} min`,
      tags: [] as string[],
      unit: pricingUnitLabel(option.pricingUnit),
    }));
  }, [plan, addType, hotelsQuery.data, activitiesQuery.data, transportQuery.data]);

  const filteredAddOptions = useMemo(() => {
    const query = addSearch.trim().toLowerCase();
    if (!query) return addOptions;
    return addOptions.filter(
      (option) =>
        option.name.toLowerCase().includes(query) ||
        option.meta.toLowerCase().includes(query) ||
        option.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [addOptions, addSearch]);

  if (planQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-12 w-2/3 animate-pulse rounded-full bg-mint-light" />
        <div className="mt-5 h-[240px] animate-pulse rounded-[26px] bg-mint-light" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[18px] bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (planQuery.isError || !plan || !activeDay) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-20 text-center">
        <Icon name="alert" size={40} className="mx-auto text-orange-dark" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">No pudimos abrir este plan.</h1>
        <p className="mt-2 text-sm text-muted">
          Puede que sea de otra cuenta o que ya no exista.
        </p>
        <Link
          to="/plans"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white"
        >
          <Icon name="arrowLeft" size={16} /> Volver a mis planes
        </Link>
      </div>
    );
  }

  const range = dateRangeFromDays(plan.days);
  const heroImage = plan.heroImageUrl ?? plan.destination.heroImageUrl;
  const title = planTitle(plan);

  return (
    <div className="pb-44">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/plans"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold text-muted transition-colors hover:text-forest focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="arrowLeft" size={16} /> Mis planes
          </Link>
          <span className="text-muted/40" aria-hidden="true">
            /
          </span>
          <span className="truncate text-sm font-medium text-muted">{plan.destination.city}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 w-full lg:w-auto lg:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(plan.status)}>{statusLabel(plan.status)}</Badge>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                v{plan.version}
              </span>
            </div>
            <h1 className="mt-2 max-w-[24ch] font-heading text-3xl font-extrabold leading-[1.05] sm:text-[40px]">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {plan.destination.city}, {plan.destination.country} ·{' '}
              {range.start && range.end ? `${formatDateShort(range.start)} – ${formatDateShort(range.end)}` : 'Fechas por definir'} ·{' '}
              {plan.days.length} {plan.days.length === 1 ? 'día' : 'días'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              isLoading={downloading === 'pdf'}
              onClick={() => void handleDownload('pdf')}
            >
              <Icon name="download" size={15} /> PDF
            </Button>
            {!readOnly ? (
              <>
                <Button variant="outline" size="sm" onClick={openMeta}>
                  <Icon name="edit" size={15} /> Editar relato
                </Button>
                {plan.status === 'DRAFT' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Icon name="save" size={15} /> Guardar
                  </Button>
                ) : null}
                <Button
                  variant="cta"
                  size="sm"
                  isLoading={publishMutation.isPending}
                  onClick={() => setConfirmAction('publish')}
                >
                  <Icon name="send" size={15} /> Publicar
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                isLoading={duplicateMutation.isPending}
                onClick={() => setConfirmAction('duplicate')}
              >
                <Icon name="copy" size={15} /> Duplicar para editar
              </Button>
            )}
            {!readOnly ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmAction('duplicate')}
                title="Duplicar plan"
              >
                <Icon name="copy" size={15} /> Duplicar
              </Button>
            ) : null}
            {plan.status !== 'ARCHIVED' ? (
              <Button
                variant="danger-outline"
                size="sm"
                onClick={() => setConfirmAction('archive')}
                title="Archivar plan"
              >
                <Icon name="trash" size={15} />
                <span className="hidden sm:inline">Archivar</span>
              </Button>
            ) : null}
          </div>
        </div>

        {readOnly ? (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-sm ${
              plan.status === 'PUBLISHED'
                ? 'border-teal bg-mint-light text-forest'
                : 'border-border bg-white text-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon name={plan.status === 'PUBLISHED' ? 'checkCircle' : 'info'} size={17} />
              {plan.status === 'PUBLISHED'
                ? 'Este plan está publicado y es de solo lectura. Duplícalo para hacer cambios.'
                : 'Este plan está archivado. Duplícalo para retomarlo como borrador.'}
            </span>
            <Button
              variant="primary"
              size="sm"
              isLoading={duplicateMutation.isPending}
              onClick={() => setConfirmAction('duplicate')}
            >
              <Icon name="copy" size={14} /> Duplicar
            </Button>
          </div>
        ) : null}

        {/* Hero */}
        <section className="relative mt-5 overflow-hidden rounded-[26px] bg-forest text-white shadow-[0_24px_50px_-30px_rgba(16,38,42,0.5)]">
          <div className="relative min-h-[250px]">
            {heroImage ? (
              <img
                src={heroImage}
                alt={`Imagen de referencia de ${plan.destination.city}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#10262A,#3F575B)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(16,38,42,0.92)_0%,rgba(16,38,42,0.55)_60%,rgba(16,38,42,0.12)_100%)]" />
            <div className="relative flex min-h-[250px] max-w-[680px] flex-col justify-end p-6 sm:p-8">
              <div className="flex flex-wrap gap-1.5">
                {plan.tags.length > 0 ? (
                  plan.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur"
                    >
                      {titleCase(tag)}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                    {plan.destination.country}
                  </span>
                )}
              </div>
              <h2 className="mt-3 font-heading text-4xl font-extrabold leading-none sm:text-5xl">
                {plan.destination.city}
              </h2>
              <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-white/75">
                {plan.summary ??
                  'Un itinerario armado sobre el catálogo real de la agencia. Cada detalle se puede cambiar antes de publicar.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="calendar" size={14} /> {formatDate(range.start)} – {formatDate(range.end)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="pin" size={14} /> {plan.destination.timezone}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Summary + tags */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-divider bg-white px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Etiquetas
            </span>
            {plan.tags.length > 0 ? (
              plan.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-mint-light px-2.5 py-1 text-[11px] font-medium text-forest"
                >
                  {titleCase(tag)}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted">Sin etiquetas todavía</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleDownload('csv')}
            disabled={downloading === 'csv'}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-forest transition-colors hover:bg-mint-light disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-orange"
          >
            <Icon name="download" size={13} />
            {downloading === 'csv' ? 'Generando…' : 'CSV'}
          </button>
        </div>

        {/* Day tabs */}
        <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1">
          {plan.days.map((day) => (
            <button
              key={day.id}
              type="button"
              aria-pressed={day.dayNumber === activeDayNumber}
              onClick={() => setActiveDayNumber(day.dayNumber)}
              className={`min-h-[40px] flex-none cursor-pointer rounded-full px-4 text-sm transition-colors focus-visible:outline-3 focus-visible:outline-orange ${
                day.dayNumber === activeDayNumber
                  ? 'bg-forest font-bold text-white'
                  : 'bg-white font-medium text-muted hover:bg-mint-light hover:text-forest'
              }`}
            >
              Día {day.dayNumber} · {formatDateShort(day.date)}
            </button>
          ))}
        </div>

        {/* Day content */}
        <section className="mt-4" aria-labelledby="day-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                Día {activeDay.dayNumber} · {formatDate(activeDay.date)}
              </p>
              <h2 id="day-title" className="mt-1 font-heading text-2xl font-extrabold">
                {activeDay.title ?? `Itinerario del día ${activeDay.dayNumber}`}
              </h2>
              {activeDay.notes ? (
                <p className="mt-1 max-w-[64ch] text-sm text-muted">{activeDay.notes}</p>
              ) : null}
            </div>
            <p className="text-sm text-muted">
              Subtotal del día{' '}
              <span className="font-heading text-lg font-extrabold text-forest">
                {formatMoney(activeDay.subtotal)}
              </span>
            </p>
          </div>

          <div className="mt-4 space-y-2.5">
            {activeDay.items.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-border bg-white p-8 text-center">
                <Icon name="route" size={30} className="mx-auto text-muted" />
                <p className="mt-2 font-heading text-xl font-extrabold">Este día está en blanco.</p>
                <p className="mt-1 text-sm text-muted">
                  Agrega una actividad, un hotel o un trayecto del catálogo.
                </p>
                {!readOnly ? (
                  <Button variant="primary" size="sm" className="mt-4" onClick={openAdd}>
                    <Icon name="plus" size={15} /> Agregar ítem
                  </Button>
                ) : null}
              </div>
            ) : (
              activeDay.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  readOnly={Boolean(readOnly)}
                  onChange={() => setAlternativesItem(item)}
                  onEdit={() => setDetailsItem(item)}
                  onMove={() => openMove(item)}
                  onRemove={() => setRemoveTarget(item)}
                />
              ))
            )}

            {!readOnly && activeDay.items.length > 0 && activeDay.items.length < 6 ? (
              <button
                type="button"
                onClick={openAdd}
                className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-border bg-transparent text-sm font-medium text-muted transition-colors hover:border-teal hover:bg-mint-light/50 hover:text-forest focus-visible:outline-3 focus-visible:outline-orange"
              >
                <Icon name="plus" size={17} /> Agregar ítem del catálogo
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {/* Sticky budget bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/96 shadow-[0_-16px_40px_-24px_rgba(16,38,42,0.35)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Transporte</p>
              <p className="font-bold text-forest">{formatMoney(plan.budget.flights)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Hoteles</p>
              <p className="font-bold text-forest">{formatMoney(plan.budget.hotels)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Actividades</p>
              <p className="font-bold text-forest">{formatMoney(plan.budget.activities)}</p>
            </div>
            <div className="border-l-2 border-divider pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Subtotal</p>
              <p className="font-bold text-forest">{formatMoney(plan.budget.subtotal)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <label htmlFor="margin" className="text-xs font-medium text-muted">
              Margen
            </label>
            {readOnly ? (
              <span className="font-heading text-lg font-extrabold">
                {percentLabel(plan.budget.marginPercent)}%
              </span>
            ) : (
              <>
                <input
                  id="margin"
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={marginDraft}
                  onChange={(event) => setMarginDraft(Number(event.target.value))}
                  onPointerUp={commitMargin}
                  onKeyUp={commitMargin}
                  onBlur={commitMargin}
                  className="h-2 w-24 cursor-pointer accent-forest"
                  aria-valuetext={`${percentLabel(marginDraft)} por ciento`}
                />
                <span className="min-w-[48px] font-heading text-base font-extrabold">
                  {percentLabel(marginDraft)}%
                </span>
              </>
            )}
          </div>

          <div className="flex-none border-l-2 border-orange pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Total cliente
            </p>
            <p className="font-heading text-2xl font-extrabold leading-none text-forest">
              {formatMoney(plan.budget.total)}
            </p>
          </div>
        </div>
      </div>

      {/* Meta modal */}
      <Modal isOpen={metaOpen} onClose={() => setMetaOpen(false)} title="Editar relato" maxWidth="lg">
        <form onSubmit={submitMeta} className="space-y-4">
          <div>
            <label htmlFor="plan-title" className="mb-1.5 ml-2 block text-xs font-bold text-forest">
              Título
            </label>
            <input
              id="plan-title"
              type="text"
              value={metaTitle}
              maxLength={120}
              onChange={(event) => setMetaTitle(event.target.value)}
              placeholder="Cartagena Esencial 5 días"
              className="min-h-[50px] w-full rounded-full border-[1.5px] border-border bg-white px-5 text-sm text-forest placeholder:text-muted/55 focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            />
          </div>
          <div>
            <label htmlFor="plan-summary" className="mb-1.5 ml-2 block text-xs font-bold text-forest">
              Resumen para el cliente
            </label>
            <textarea
              id="plan-summary"
              value={metaSummary}
              maxLength={1000}
              rows={4}
              onChange={(event) => setMetaSummary(event.target.value)}
              placeholder="Cinco días entre el centro histórico, las islas y la gastronomía local."
              className="w-full resize-none rounded-[20px] border-[1.5px] border-border bg-white px-5 py-3 text-sm leading-relaxed text-forest placeholder:text-muted/55 focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            />
          </div>
          <div>
            <label htmlFor="plan-tags" className="mb-1.5 ml-2 block text-xs font-bold text-forest">
              Etiquetas separadas por coma
            </label>
            <input
              id="plan-tags"
              type="text"
              value={metaTags}
              onChange={(event) => setMetaTags(event.target.value)}
              placeholder="playa, cultura, gastronomía"
              className="min-h-[50px] w-full rounded-full border-[1.5px] border-border bg-white px-5 text-sm text-forest placeholder:text-muted/55 focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setMetaOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={metaMutation.isPending}>
              <Icon name="save" size={15} /> Guardar relato
            </Button>
          </div>
        </form>
      </Modal>

      {/* Alternatives modal */}
      <Modal
        isOpen={Boolean(alternativesItem)}
        onClose={() => setAlternativesItem(null)}
        title="Cambiar por una alternativa"
        maxWidth="lg"
      >
        <p className="mb-4 text-sm text-muted">
          Reemplazar <span className="font-bold text-forest">{alternativesItem?.name}</span> · mismo
          tipo, destino y moneda. El servidor recalcula el presupuesto.
        </p>
        {alternativesQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[18px] bg-mint-light" />
            ))}
          </div>
        ) : alternativesQuery.data && alternativesQuery.data.length > 0 ? (
          <div className="space-y-2">
            {alternativesQuery.data.map((alternative) => {
              const delta =
                alternative.price.amountMinor - (alternativesItem?.unitPrice.amountMinor ?? 0);
              return (
                <div
                  key={alternative.id}
                  className="flex flex-wrap items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-white p-4"
                >
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-[14px] bg-mint text-forest">
                    <Icon name={typeIcon[alternative.type]} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-base font-extrabold leading-tight">
                      {alternative.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {alternative.category ? `${alternative.category} estrellas · ` : ''}
                      {alternative.durationMinutes ? `${alternative.durationMinutes} min · ` : ''}
                      {pricingUnitLabel(alternative.pricingUnit)}
                    </p>
                    {alternative.tags.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {alternative.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-mint-light px-2 py-0.5 text-[10px] font-medium text-forest"
                          >
                            {titleCase(tag)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex-none text-right">
                    <p className="font-heading text-base font-extrabold">
                      {formatMoney(alternative.price)}
                    </p>
                    <p
                      className={`text-[11px] font-bold ${
                        delta < 0
                          ? 'text-forest'
                          : delta > 0
                            ? 'text-orange-dark'
                            : 'text-muted'
                      }`}
                    >
                      {delta === 0
                        ? 'Mismo precio'
                        : `${delta < 0 ? '↓' : '↑'} ${formatMoney({
                            amountMinor: Math.abs(delta),
                            currency: alternative.price.currency,
                          })}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={replaceMutation.isPending}
                    onClick={() => replaceMutation.mutate(alternative.id)}
                  >
                    Elegir
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-[18px] border border-dashed border-border bg-white p-6 text-center text-sm text-muted">
            No hay alternativas disponibles para este ítem.
          </p>
        )}
      </Modal>

      {/* Details modal */}
      <Modal
        isOpen={Boolean(detailsItem)}
        onClose={() => setDetailsItem(null)}
        title="Editar ítem"
        maxWidth="md"
      >
        <p className="mb-4 text-sm text-muted">
          Ajusta cantidad, horario y notas de{' '}
          <span className="font-bold text-forest">{detailsItem?.name}</span>. Los precios se
          recalculan en el servidor.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            detailsMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="item-quantity" className="mb-1.5 ml-2 block text-xs font-bold">
                Cantidad
              </label>
              <input
                id="item-quantity"
                type="number"
                min={1}
                max={99}
                value={detailsForm.quantity}
                onChange={(event) =>
                  setDetailsForm((current) => ({
                    ...current,
                    quantity: Number(event.target.value),
                  }))
                }
                className="min-h-[46px] w-full rounded-full border-[1.5px] border-border bg-white px-4 text-sm focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange"
              />
            </div>
            <div>
              <label htmlFor="item-start" className="mb-1.5 ml-2 block text-xs font-bold">
                Inicio
              </label>
              <input
                id="item-start"
                type="time"
                value={detailsForm.startTime}
                onChange={(event) =>
                  setDetailsForm((current) => ({ ...current, startTime: event.target.value }))
                }
                className="min-h-[46px] w-full rounded-full border-[1.5px] border-border bg-white px-4 text-sm focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange"
              />
            </div>
            <div>
              <label htmlFor="item-end" className="mb-1.5 ml-2 block text-xs font-bold">
                Fin
              </label>
              <input
                id="item-end"
                type="time"
                value={detailsForm.endTime}
                onChange={(event) =>
                  setDetailsForm((current) => ({ ...current, endTime: event.target.value }))
                }
                className="min-h-[46px] w-full rounded-full border-[1.5px] border-border bg-white px-4 text-sm focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange"
              />
            </div>
          </div>
          <div>
            <label htmlFor="item-notes" className="mb-1.5 ml-2 block text-xs font-bold">
              Notas
            </label>
            <textarea
              id="item-notes"
              rows={3}
              maxLength={500}
              value={detailsForm.notes}
              onChange={(event) =>
                setDetailsForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Check-in tardío, punto de encuentro, preferencia alimentaria…"
              className="w-full resize-none rounded-[20px] border-[1.5px] border-border bg-white px-4 py-3 text-sm leading-relaxed focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setDetailsItem(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={detailsMutation.isPending}>
              <Icon name="save" size={15} /> Guardar cambios
            </Button>
          </div>
        </form>
      </Modal>

      {/* Move modal */}
      <Modal
        isOpen={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        title="Mover a otro día"
        maxWidth="sm"
      >
        <p className="mb-4 text-sm text-muted">
          <span className="font-bold text-forest">{moveTarget?.name}</span> se moverá al final del
          día elegido.
        </p>
        <label htmlFor="move-day" className="mb-1.5 ml-2 block text-xs font-bold">
          Día
        </label>
        <select
          id="move-day"
          value={moveDay}
          onChange={(event) => setMoveDay(Number(event.target.value))}
          className="min-h-[48px] w-full rounded-full border-[1.5px] border-border bg-white px-4 text-sm focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange"
        >
          {plan.days.map((day) => (
            <option key={day.id} value={day.dayNumber}>
              Día {day.dayNumber} · {formatDateShort(day.date)}
            </option>
          ))}
        </select>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setMoveTarget(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            isLoading={moveMutation.isPending}
            onClick={() => moveMutation.mutate()}
          >
            <Icon name="calendar" size={15} /> Mover
          </Button>
        </div>
      </Modal>

      {/* Remove modal */}
      <Modal
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Quitar ítem"
        maxWidth="sm"
      >
        <p className="text-sm leading-relaxed text-muted">
          ¿Quitar <span className="font-bold text-forest">{removeTarget?.name}</span> del plan? El
          presupuesto se recalculará automáticamente.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setRemoveTarget(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger-outline"
            isLoading={removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            <Icon name="trash" size={15} /> Quitar
          </Button>
        </div>
      </Modal>

      {/* Add item modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Agregar al itinerario" maxWidth="xl">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'ACCOMMODATION' as const, label: 'Hotel', icon: 'hotel' as const },
              { id: 'ACTIVITY' as const, label: 'Actividad', icon: 'activity' as const },
              { id: 'TRANSPORT' as const, label: 'Transporte', icon: 'plane' as const },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={addType === tab.id}
              onClick={() => setAddType(tab.id)}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-xs font-bold transition-colors focus-visible:outline-3 focus-visible:outline-orange ${
                addType === tab.id
                  ? 'border-forest bg-forest text-white'
                  : 'border-border bg-white text-muted hover:bg-mint-light hover:text-forest'
              }`}
            >
              <Icon name={tab.icon} size={14} /> {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted">Día</span>
          <select
            aria-label="Día del itinerario"
            value={addDay}
            onChange={(event) => setAddDay(Number(event.target.value))}
            className="min-h-[38px] rounded-full border-[1.5px] border-border bg-white px-3 text-xs font-bold focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange"
          >
            {plan.days.map((day) => (
              <option key={day.id} value={day.dayNumber}>
                Día {day.dayNumber} · {formatDateShort(day.date)}
              </option>
            ))}
          </select>
        </div>

        <div className="relative mt-3">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <label htmlFor="add-search" className="sr-only">
            Buscar en el catálogo
          </label>
          <input
            id="add-search"
            type="search"
            value={addSearch}
            onChange={(event) => setAddSearch(event.target.value)}
            placeholder="Buscar por nombre, etiqueta o proveedor…"
            className="min-h-[42px] w-full rounded-full border-[1.5px] border-border bg-white pl-10 pr-4 text-sm placeholder:text-muted/55 focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange"
          />
        </div>

        <div className="mt-3 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {(addType === 'ACCOMMODATION'
            ? hotelsQuery.isLoading
            : addType === 'ACTIVITY'
              ? activitiesQuery.isLoading
              : transportQuery.isLoading) ? (
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[18px] bg-mint-light" />
            ))
          ) : filteredAddOptions.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-border bg-white p-6 text-center text-sm text-muted">
              No hay opciones que coincidan con la búsqueda.
            </p>
          ) : (
            filteredAddOptions.map((option) => (
              <div
                key={option.id}
                className="flex flex-wrap items-center gap-3 rounded-[18px] border border-divider bg-white p-3.5"
              >
                <span className={`grid h-11 w-11 flex-none place-items-center rounded-[13px] ${typeSurface[addType]}`}>
                  <Icon name={typeIcon[addType]} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-extrabold leading-tight">{option.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{option.meta}</p>
                  {option.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {option.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-mint-light px-2 py-0.5 text-[10px] font-medium text-forest"
                        >
                          {titleCase(tag)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex-none text-right">
                  <p className="font-heading text-sm font-extrabold">{formatMoney(option.price)}</p>
                  <p className="text-[10px] text-muted">{option.unit}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={addMutation.isPending}
                  onClick={() =>
                    addMutation.mutate({
                      dayNumber: addDay,
                      type: addType,
                      catalogItemId: option.id,
                    })
                  }
                >
                  <Icon name="plus" size={13} /> Agregar
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Confirm lifecycle modal */}
      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction === 'publish'
            ? 'Publicar plan'
            : confirmAction === 'archive'
              ? 'Archivar plan'
              : 'Duplicar plan'
        }
        maxWidth="sm"
      >
        <p className="text-sm leading-relaxed text-muted">
          {confirmAction === 'publish'
            ? 'Al publicar, el plan pasa a solo lectura y queda listo para compartir. Si necesitas cambios después, podrás duplicarlo.'
            : confirmAction === 'archive'
              ? 'El plan saldrá del flujo activo. Podrás duplicarlo si necesitas retomarlo.'
              : 'Se creará un nuevo borrador con los mismos días e ítems, con su propio presupuesto.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmAction(null)}>
            Cancelar
          </Button>
          {confirmAction === 'publish' ? (
            <Button
              type="button"
              variant="cta"
              isLoading={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              <Icon name="send" size={15} /> Publicar
            </Button>
          ) : confirmAction === 'archive' ? (
            <Button
              type="button"
              variant="danger-outline"
              isLoading={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
            >
              <Icon name="trash" size={15} /> Archivar
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              isLoading={duplicateMutation.isPending}
              onClick={() => duplicateMutation.mutate()}
            >
              <Icon name="copy" size={15} /> Duplicar
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
};
