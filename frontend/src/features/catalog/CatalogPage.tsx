import React, { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { DestinationDto } from '@trazo/shared';
import { listDestinations } from '../../shared/api/catalog';
import { Icon } from '../../shared/components/Icon';
import { formatMoneyShort, titleCase } from '../../shared/lib/format';
import { destinationImage } from '../../shared/lib/images';

const filterTags = [
  'playa',
  'cultura',
  'naturaleza',
  'aventura',
  'gastronomia',
  'cafe',
  'ciudad',
  'historia',
];

const FeaturedDestination: React.FC<{ destination: DestinationDto }> = ({ destination }) => {
  const image = destinationImage(destination.slug, destination.heroImageUrl);

  return (
    <Link
      to={`/catalog/${destination.id}`}
      className="group relative block overflow-hidden rounded-[30px] border border-divider bg-forest text-white shadow-[0_24px_50px_-28px_rgba(16,38,42,0.5)] focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
    >
      <div className="relative h-[330px] sm:h-[360px]">
        {image ? (
          <img
            src={image}
            alt={`Imagen de ${destination.city}`}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#10262A,#3F575B)] text-white/20">
            <Icon name="map" size={90} strokeWidth={1.1} />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(16,38,42,0.9)_0%,rgba(16,38,42,0.55)_55%,rgba(16,38,42,0.1)_100%)]" />
        <div className="absolute inset-0 flex max-w-[640px] flex-col justify-end p-6 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-forest">
              Destacado
            </span>
            {destination.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur"
              >
                {titleCase(tag)}
              </span>
            ))}
          </div>
          <h2 className="mt-3 font-heading text-4xl font-extrabold leading-none sm:text-[46px]">
            {destination.city}
          </h2>
          <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-white/75">
            {destination.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold">
              Explorar destino <Icon name="arrowRight" size={16} />
            </span>
            <span className="text-sm text-white/60">
              Desde{' '}
              <span className="font-bold text-white">
                {destination.fromPrice ? formatMoneyShort(destination.fromPrice) : 'por definir'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const DestinationCard: React.FC<{ destination: DestinationDto }> = ({ destination }) => {
  const image = destinationImage(destination.slug, destination.heroImageUrl);

  return (
    <Link
      to={`/catalog/${destination.id}`}
      className="group flex flex-col overflow-hidden rounded-[24px] border border-divider bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-24px_rgba(16,38,42,0.35)] focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3"
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
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#CFEAE3,#9ADBCB)] text-forest/35">
            <Icon name="mountain" size={54} strokeWidth={1.4} />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,42,0.02)_35%,rgba(16,38,42,0.78))]" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="font-heading text-[22px] font-extrabold leading-tight">{destination.city}</p>
          <p className="text-xs text-white/75">{destination.country}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{destination.description}</p>
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
            Ver ficha <Icon name="arrowRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
};

export const CatalogPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());

  const destinationsQuery = useQuery({
    queryKey: ['catalog', 'destinations', { q: deferredQuery, featured: onlyFeatured }],
    queryFn: () =>
      listDestinations({
        q: deferredQuery || undefined,
        featured: onlyFeatured || undefined,
        pageSize: 50,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const items = destinationsQuery.data?.items ?? [];
  const filtered = useMemo(
    () => (activeTag ? items.filter((item) => item.tags.includes(activeTag)) : items),
    [items, activeTag],
  );
  const featured = filtered.find((item) => item.isFeatured) ?? filtered[0];
  const rest = filtered.filter((item) => item.id !== featured?.id);

  const clearFilters = () => {
    setQuery('');
    setActiveTag(null);
    setOnlyFeatured(false);
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-9 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            Explorador · Colombia
          </p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold sm:text-5xl">Catálogo</h1>
          <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
            Destinos, hoteles, experiencias y transporte reales. Entra a un destino para comparar
            opciones y empezar un viaje desde ahí.
          </p>
        </div>
        <div className="rounded-2xl border border-divider bg-white px-4 py-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Destinos activos
          </p>
          <p className="font-heading text-3xl font-extrabold leading-none">
            {destinationsQuery.data?.total ?? '—'}
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="mt-7 flex flex-col gap-3 rounded-[24px] border border-divider bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <label htmlFor="catalog-search" className="sr-only">
              Buscar destino
            </label>
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por ciudad o experiencia…"
              className="min-h-[46px] w-full rounded-full border-[1.5px] border-border bg-sand pl-11 pr-4 text-sm text-forest placeholder:text-muted/60 transition-colors focus-visible:border-forest focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            />
          </div>
          <button
            type="button"
            aria-pressed={onlyFeatured}
            onClick={() => setOnlyFeatured((value) => !value)}
            className={`inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2 ${
              onlyFeatured
                ? 'border-forest bg-forest text-white'
                : 'border-border bg-white text-forest hover:bg-mint-light'
            }`}
          >
            <Icon name="star" size={16} /> Solo destacados
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={activeTag === null}
            onClick={() => setActiveTag(null)}
            className={`min-h-[34px] cursor-pointer rounded-full border-[1.5px] px-3 text-xs font-bold transition-colors focus-visible:outline-3 focus-visible:outline-orange ${
              activeTag === null
                ? 'border-teal bg-teal text-forest'
                : 'border-border bg-white text-muted hover:bg-mint-light hover:text-forest'
            }`}
          >
            Todos
          </button>
          {filterTags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
              className={`min-h-[34px] cursor-pointer rounded-full border-[1.5px] px-3 text-xs font-medium transition-colors focus-visible:outline-3 focus-visible:outline-orange ${
                activeTag === tag
                  ? 'border-teal bg-teal font-bold text-forest'
                  : 'border-border bg-white text-muted hover:bg-mint-light hover:text-forest'
              }`}
            >
              {titleCase(tag)}
            </button>
          ))}
        </div>
      </div>

      {destinationsQuery.isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-[24px] border border-divider bg-white">
              <div className="h-44 animate-pulse bg-mint-light" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-4/5 animate-pulse rounded-full bg-divider" />
                <div className="h-3 w-3/5 animate-pulse rounded-full bg-divider" />
                <div className="h-8 w-2/5 animate-pulse rounded-full bg-divider" />
              </div>
            </div>
          ))}
        </div>
      ) : destinationsQuery.isError ? (
        <div className="mt-8 rounded-[24px] border border-orange-dark/25 bg-orange-dark/5 p-8 text-center">
          <Icon name="alert" size={30} className="mx-auto text-orange-dark" />
          <p className="mt-3 font-heading text-xl font-extrabold">No pudimos abrir el catálogo.</p>
          <p className="mt-1 text-sm text-muted">Revisa la conexión e inténtalo otra vez.</p>
          <button
            type="button"
            onClick={() => void destinationsQuery.refetch()}
            className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full bg-forest px-4 text-sm font-bold text-white"
          >
            <Icon name="refresh" size={16} /> Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-border bg-white p-10 text-center">
          <Icon name="compass" size={34} className="mx-auto text-muted" />
          <p className="mt-3 font-heading text-2xl font-extrabold">No encontramos ese destino.</p>
          <p className="mt-1 text-sm text-muted">
            Prueba con otra ciudad o quita los filtros activos.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-border px-4 text-sm font-bold text-forest hover:bg-mint-light"
          >
            <Icon name="refresh" size={16} /> Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          {featured ? (
            <div className="mt-6">
              <FeaturedDestination destination={featured} />
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((destination) => (
              <DestinationCard key={destination.id} destination={destination} />
            ))}
          </div>

          <p className="mt-6 text-xs text-muted">
            {filtered.length} {filtered.length === 1 ? 'destino' : 'destinos'} · Fotografías de
            referencia de cada destino.
          </p>
        </>
      )}
    </div>
  );
};
