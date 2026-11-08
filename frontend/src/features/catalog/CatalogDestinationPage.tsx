import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ActivityDto, HotelDto, TransportOptionDto } from '@trazo/shared';
import {
  getDestination,
  listActivities,
  listDestinations,
  listHotels,
  listTransport,
} from '../../shared/api/catalog';
import { Icon } from '../../shared/components/Icon';
import type { IconName } from '../../shared/components/Icon';
import {
  durationLabel,
  formatMoney,
  formatMoneyShort,
  intensityLabel,
  pricingUnitLabel,
  titleCase,
  transportModeLabel,
} from '../../shared/lib/format';

type Tab = 'hotels' | 'activities' | 'transport';

const transportIcon: Record<TransportOptionDto['mode'], IconName> = {
  FLIGHT: 'plane',
  BUS: 'bus',
  CAR_RENTAL: 'car',
  BOAT: 'boat',
  TRAIN: 'train',
};

const intensityClasses: Record<ActivityDto['intensity'], string> = {
  LOW: 'bg-mint text-forest',
  MEDIUM: 'bg-gold text-forest',
  HIGH: 'bg-orange/15 text-orange-dark',
};

const HotelCard: React.FC<{ hotel: HotelDto }> = ({ hotel }) => {
  const amenities = Object.entries(hotel.amenities ?? {})
    .filter(([, value]) => value === true || typeof value === 'string')
    .slice(0, 3)
    .map(([key]) => titleCase(key));

  return (
    <article className="flex flex-col overflow-hidden rounded-[22px] border border-divider bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-24px_rgba(16,38,42,0.3)]">
      <div className="relative h-40 overflow-hidden bg-mint">
        {hotel.imageUrl ? (
          <img
            src={hotel.imageUrl}
            alt={`Imagen de referencia de ${hotel.name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#FFD36B33,#CFEAE3)] text-forest/30">
            <Icon name="hotel" size={46} strokeWidth={1.4} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-forest backdrop-blur">
          {'★'.repeat(hotel.category)}
          <span className="text-muted">{'★'.repeat(5 - hotel.category)}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-extrabold leading-tight">{hotel.name}</h3>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted">
          {hotel.roomType}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{hotel.description}</p>
        {amenities.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {amenities.map((amenity) => (
              <span
                key={amenity}
                className="rounded-full bg-mint-light px-2.5 py-1 text-[11px] font-medium text-forest"
              >
                {amenity}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Por noche</p>
            <p className="font-heading text-xl font-extrabold">{formatMoney(hotel.pricePerNight)}</p>
          </div>
          <span className="rounded-full bg-mint-light px-2.5 py-1 text-[11px] font-bold text-forest">
            {hotel.category} estrellas
          </span>
        </div>
      </div>
    </article>
  );
};

const ActivityCard: React.FC<{ activity: ActivityDto }> = ({ activity }) => (
  <article className="flex flex-col overflow-hidden rounded-[22px] border border-divider bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-24px_rgba(16,38,42,0.3)]">
    <div className="relative h-40 overflow-hidden bg-mint">
      {activity.imageUrl ? (
        <img
          src={activity.imageUrl}
          alt={`Imagen de referencia de ${activity.name}`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#CFEAE3,#9ADBCB)] text-forest/30">
          <Icon name="activity" size={46} strokeWidth={1.4} />
        </div>
      )}
      <span
        className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${intensityClasses[activity.intensity]}`}
      >
        {intensityLabel(activity.intensity)}
      </span>
    </div>
    <div className="flex flex-1 flex-col p-5">
      <h3 className="font-heading text-lg font-extrabold leading-tight">{activity.name}</h3>
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
        <Icon name="clock" size={13} /> {durationLabel(activity.durationMinutes)}
      </p>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{activity.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {activity.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-mint-light px-2.5 py-1 text-[11px] font-medium text-forest"
          >
            {titleCase(tag)}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Por persona</p>
        <p className="font-heading text-xl font-extrabold">{formatMoney(activity.pricePerPerson)}</p>
      </div>
    </div>
  </article>
);

const TransportCard: React.FC<{ option: TransportOptionDto; originName: string | null }> = ({
  option,
  originName,
}) => (
  <article className="flex items-center gap-4 rounded-[20px] border border-divider bg-white p-4 transition-colors hover:border-mint">
    <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-mint-light text-forest">
      <Icon name={transportIcon[option.mode]} size={23} />
    </span>
    <div className="min-w-0 flex-1">
      <h3 className="truncate font-heading text-base font-extrabold">{option.provider}</h3>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{transportModeLabel(option.mode)}</span>
        <span aria-hidden="true">·</span>
        <span>{durationLabel(option.durationMinutes)}</span>
        {originName ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Desde {originName}</span>
          </>
        ) : null}
      </p>
    </div>
    <div className="flex-none text-right">
      <p className="font-heading text-lg font-extrabold">{formatMoney(option.price)}</p>
      <p className="text-[11px] text-muted">{pricingUnitLabel(option.pricingUnit)}</p>
    </div>
  </article>
);

const LoadingCard: React.FC = () => (
  <div className="overflow-hidden rounded-[22px] border border-divider bg-white">
    <div className="h-40 animate-pulse bg-mint-light" />
    <div className="space-y-3 p-5">
      <div className="h-3 w-3/4 animate-pulse rounded-full bg-divider" />
      <div className="h-3 w-1/2 animate-pulse rounded-full bg-divider" />
      <div className="h-6 w-2/5 animate-pulse rounded-full bg-divider" />
    </div>
  </div>
);

export const CatalogDestinationPage: React.FC = () => {
  const { destinationId } = useParams<{ destinationId: string }>();
  const [tab, setTab] = useState<Tab>('hotels');

  const destinationQuery = useQuery({
    queryKey: ['catalog', 'destination', destinationId],
    queryFn: () => getDestination(destinationId as string),
    enabled: Boolean(destinationId),
    staleTime: 5 * 60 * 1000,
  });

  const hotelsQuery = useQuery({
    queryKey: ['catalog', 'hotels', destinationId],
    queryFn: () => listHotels(destinationId as string),
    enabled: Boolean(destinationId),
  });

  const activitiesQuery = useQuery({
    queryKey: ['catalog', 'activities', destinationId],
    queryFn: () => listActivities(destinationId as string),
    enabled: Boolean(destinationId),
  });

  const transportQuery = useQuery({
    queryKey: ['catalog', 'transport', destinationId],
    queryFn: () => listTransport(destinationId as string),
    enabled: Boolean(destinationId),
  });

  const allDestinationsQuery = useQuery({
    queryKey: ['catalog', 'destinations', 'all-names'],
    queryFn: () => listDestinations({ pageSize: 50 }),
    staleTime: 10 * 60 * 1000,
  });

  const destinationNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allDestinationsQuery.data?.items ?? []) map.set(item.id, item.city);
    return map;
  }, [allDestinationsQuery.data]);

  const destination = destinationQuery.data;
  const hotels = hotelsQuery.data?.items ?? [];
  const activities = activitiesQuery.data?.items ?? [];
  const transport = transportQuery.data?.items ?? [];

  if (destinationQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-[300px] animate-pulse rounded-[30px] bg-mint-light" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <LoadingCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (destinationQuery.isError || !destination) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-20 text-center sm:px-6">
        <Icon name="compass" size={44} className="mx-auto text-muted" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">No encontramos ese destino.</h1>
        <p className="mt-2 text-sm text-muted">
          Puede que ya no esté activo en el catálogo. Vuelve para ver las opciones disponibles.
        </p>
        <Link
          to="/catalog"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white"
        >
          <Icon name="arrowLeft" size={16} /> Volver al catálogo
        </Link>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; count: number; icon: IconName }> = [
    { id: 'hotels', label: 'Hoteles', count: hotels.length, icon: 'hotel' },
    { id: 'activities', label: 'Actividades', count: activities.length, icon: 'activity' },
    { id: 'transport', label: 'Transporte', count: transport.length, icon: 'plane' },
  ];

  const activeQuery =
    tab === 'hotels' ? hotelsQuery : tab === 'activities' ? activitiesQuery : transportQuery;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <Link
        to="/catalog"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold text-muted transition-colors hover:text-forest focus-visible:outline-3 focus-visible:outline-orange"
      >
        <Icon name="arrowLeft" size={16} /> Catálogo
      </Link>

      {/* Destination hero */}
      <section className="relative mt-4 overflow-hidden rounded-[30px] bg-forest text-white shadow-[0_26px_50px_-30px_rgba(16,38,42,0.55)]">
        <div className="relative min-h-[340px]">
          {destination.heroImageUrl ? (
            <img
              src={destination.heroImageUrl}
              alt={`Imagen de referencia de ${destination.city}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#10262A,#3F575B)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(16,38,42,0.92)_0%,rgba(16,38,42,0.62)_58%,rgba(16,38,42,0.18)_100%)]" />
          <div className="relative flex min-h-[340px] max-w-[680px] flex-col justify-end p-6 sm:p-9">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-teal px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-forest">
                {destination.country}
              </span>
              {destination.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur"
                >
                  {titleCase(tag)}
                </span>
              ))}
            </div>
            <h1 className="mt-3 font-heading text-5xl font-extrabold leading-none sm:text-[62px]">
              {destination.city}
            </h1>
            <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-white/80 sm:text-base">
              {destination.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={`/?mode=ia&destination=${encodeURIComponent(destination.city)}`}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_0_#10262A] focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-3"
              >
                <Icon name="sparkles" size={17} /> Diseñar un viaje aquí
              </Link>
              <a
                href={`https://www.openstreetmap.org/?mlat=${destination.latitude}&mlon=${destination.longitude}#map=12/${destination.latitude}/${destination.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-white"
              >
                <Icon name="pin" size={16} /> Ver en el mapa
                <Icon name="external" size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quick facts */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-divider bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Desde</p>
          <p className="mt-0.5 font-heading text-xl font-extrabold">
            {destination.fromPrice ? formatMoneyShort(destination.fromPrice) : 'Por definir'}
          </p>
          <p className="text-[11px] text-muted">hotel por noche</p>
        </div>
        <div className="rounded-[18px] border border-divider bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Ubicación</p>
          <p className="mt-0.5 font-heading text-xl font-extrabold">
            {destination.latitude.toFixed(2)}, {destination.longitude.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted">{destination.timezone}</p>
        </div>
        <div className="rounded-[18px] border border-divider bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">En el catálogo</p>
          <p className="mt-0.5 font-heading text-xl font-extrabold">
            {hotels.length + activities.length + transport.length} opciones
          </p>
          <p className="text-[11px] text-muted">
            {hotels.length} hoteles · {activities.length} actividades · {transport.length} rutas
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-1.5 rounded-full border border-divider bg-white p-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors focus-visible:outline-3 focus-visible:outline-orange ${
              tab === item.id
                ? 'bg-forest font-bold text-white'
                : 'font-medium text-muted hover:bg-mint-light hover:text-forest'
            }`}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === item.id ? 'bg-white/15 text-white' : 'bg-mint-light text-forest'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        {activeQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <LoadingCard key={index} />
            ))}
          </div>
        ) : activeQuery.isError ? (
          <div className="rounded-[22px] border border-orange-dark/25 bg-orange-dark/5 p-6 text-sm text-orange-dark">
            No pudimos cargar esta sección del catálogo.
          </div>
        ) : tab === 'hotels' ? (
          hotels.length === 0 ? (
            <p className="rounded-[22px] border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
              Este destino aún no tiene hoteles activos.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hotels.map((hotel) => (
                <HotelCard key={hotel.id} hotel={hotel} />
              ))}
            </div>
          )
        ) : tab === 'activities' ? (
          activities.length === 0 ? (
            <p className="rounded-[22px] border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
              Este destino aún no tiene actividades activas.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )
        ) : transport.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
            Este destino aún no tiene opciones de transporte activas.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {transport.map((option) => (
              <TransportCard
                key={option.id}
                option={option}
                originName={
                  option.originDestinationId
                    ? (destinationNames.get(option.originDestinationId) ?? null)
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-muted">
        Precios en {destination.fromPrice?.currency ?? 'COP'} tomados del catálogo. Las imágenes son
        referencias y se reemplazarán por fotografía propia.
      </p>
    </div>
  );
};
