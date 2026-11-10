import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import type { ActivityIntensity, PricingUnit, TransportMode } from '@trazo/shared';
import { env } from '../src/config/env.js';
import { SupabaseStorage } from '../src/infrastructure/storage/supabase-storage.js';

const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, 'assets/catalog');

const storageConfig =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? {
        url: env.SUPABASE_URL,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        bucket: env.SUPABASE_STORAGE_BUCKET,
      }
    : null;

let storage = storageConfig ? new SupabaseStorage(storageConfig) : null;

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

const uploadedImageUrls = new Map<string, string | null>();

async function uploadCatalogImage(objectPath: string): Promise<string | null> {
  if (uploadedImageUrls.has(objectPath)) return uploadedImageUrls.get(objectPath) ?? null;

  const localPath = join(assetsDir, objectPath);
  const activeStorage = storage;
  if (!activeStorage || !existsSync(localPath)) {
    uploadedImageUrls.set(objectPath, null);
    return null;
  }

  const body = await readFile(localPath);
  await activeStorage.upload({ path: objectPath, body, contentType: 'image/webp' });
  const url = activeStorage.publicUrl(objectPath);
  uploadedImageUrls.set(objectPath, url);
  return url;
}

/**
 * Returns the public URL of the specific asset, or the destination hero as a
 * fallback when the catalog item does not have its own photo yet. When Storage
 * is not configured it returns null; the SPA renders the local destination
 * images from `frontend/public/images/destinations/`.
 */
async function resolveImageUrl(key: string, fallbackKey?: string): Promise<string | null> {
  const ownUrl = await uploadCatalogImage(`${key}.webp`);
  if (ownUrl) return ownUrl;

  if (fallbackKey) {
    const fallbackUrl = await uploadCatalogImage(`${fallbackKey}.webp`);
    if (fallbackUrl) return fallbackUrl;
  }

  if (storage) {
    console.warn(`[seed] Missing local image for ${key}; leaving image empty`);
  }
  return null;
}

interface DestinationSeed {
  city: string;
  country: string;
  slug: string;
  description: string;
  latitude: number;
  longitude: number;
  tags: string[];
  isFeatured: boolean;
}

interface HotelSeed {
  name: string;
  description: string;
  category: number;
  roomType: string;
  pricePerNightMinor: number;
  amenities: Record<string, boolean | string>;
}

interface ActivitySeed {
  name: string;
  description: string;
  intensity: ActivityIntensity;
  durationMinutes: number;
  pricePerPersonMinor: number;
  tags: string[];
}

interface TransportSeed {
  originSlug: string | null;
  destinationSlug: string;
  mode: TransportMode;
  provider: string;
  priceMinor: number;
  pricingUnit: PricingUnit;
  durationMinutes: number;
}

const destinations: DestinationSeed[] = [
  {
    city: 'Cartagena',
    country: 'Colombia',
    slug: 'cartagena',
    description:
      'Ciudad amurallada frente al Caribe: historia colonial, playas cercanas y una gastronomía que mezcla sabores afrocaribeños.',
    latitude: 10.391049,
    longitude: -75.479426,
    tags: ['playa', 'historia', 'gastronomia', 'ciudad-amurallada'],
    isFeatured: true,
  },
  {
    city: 'Salento',
    country: 'Colombia',
    slug: 'eje-cafetero',
    description:
      'Paisaje Cultural Cafetero entre palmas de cera, fincas tradicionales y pueblos de colores.',
    latitude: 4.637,
    longitude: -75.57,
    tags: ['cafe', 'naturaleza', 'aventura'],
    isFeatured: true,
  },
  {
    city: 'Medellín',
    country: 'Colombia',
    slug: 'medellin',
    description:
      'Ciudad de la eterna primavera: cultura urbana, gastronomía, vida nocturna y montañas cercanas.',
    latitude: 6.244203,
    longitude: -75.581211,
    tags: ['ciudad', 'cultura', 'vida-nocturna', 'gastronomia'],
    isFeatured: true,
  },
  {
    city: 'San Andrés',
    country: 'Colombia',
    slug: 'san-andres',
    description:
      'Isla del Caribe con aguas turquesa, arrecifes de coral y una cultura isleña única.',
    latitude: 12.584,
    longitude: -81.7,
    tags: ['playa', 'buceo', 'caribe'],
    isFeatured: true,
  },
  {
    city: 'Santa Marta',
    country: 'Colombia',
    slug: 'santa-marta',
    description:
      'La ciudad más antigua de Colombia: playas, Sierra Nevada, historia y naturaleza en un mismo viaje.',
    latitude: 11.24,
    longitude: -74.199,
    tags: ['playa', 'naturaleza', 'historia', 'aventura'],
    isFeatured: true,
  },
  {
    city: 'Bogotá',
    country: 'Colombia',
    slug: 'bogota',
    description:
      'La capital a 2.640 metros: museos de clase mundial, cocina de autor, arte urbano y pueblos de montaña a un paso.',
    latitude: 4.711,
    longitude: -74.0721,
    tags: ['cultura', 'gastronomia', 'historia', 'ciudad'],
    isFeatured: true,
  },
  {
    city: 'Guatapé',
    country: 'Colombia',
    slug: 'guatape',
    description:
      'Un pueblo de zócalos de colores junto al embalse: la Piedra del Peñol, lancha, kayak y atardeceres de montaña.',
    latitude: 6.232,
    longitude: -75.159,
    tags: ['naturaleza', 'pueblo', 'aventura', 'fotos'],
    isFeatured: true,
  },
];

const hotels: Record<string, HotelSeed[]> = {
  cartagena: [
    {
      name: 'Hotel Casa San Agustín',
      description: 'Hotel boutique en una casona colonial del centro histórico.',
      category: 5,
      roomType: 'Suite',
      pricePerNightMinor: 128_000_000,
      amenities: { wifi: true, pool: true, breakfast: true, spa: true },
    },
    {
      name: 'Hotel Bóvedas de San Pedro',
      description: 'Alojamiento con encanto a pasos de la muralla y la vida nocturna.',
      category: 4,
      roomType: 'Doble',
      pricePerNightMinor: 52_000_000,
      amenities: { wifi: true, breakfast: true, terrace: true },
    },
  ],
  'eje-cafetero': [
    {
      name: 'Hotel Boutique El Mirador',
      description: 'Vistas al valle de Cocora y desayuno con café de la región.',
      category: 4,
      roomType: 'Doble',
      pricePerNightMinor: 36_000_000,
      amenities: { wifi: true, breakfast: true, fireplace: true },
    },
    {
      name: 'Finca Hotel La Rivera',
      description: 'Finca cafetera familiar con recorrido por el cultivo.',
      category: 3,
      roomType: 'Familiar',
      pricePerNightMinor: 24_000_000,
      amenities: { wifi: true, breakfast: true, parking: true },
    },
  ],
  medellin: [
    {
      name: 'Hotel El Poblado Plaza',
      description: 'Hotel urbano en el corazón de El Poblado, cerca de restaurantes.',
      category: 5,
      roomType: 'Deluxe',
      pricePerNightMinor: 64_000_000,
      amenities: { wifi: true, pool: true, gym: true, breakfast: true },
    },
    {
      name: 'Hotel Laureles 70',
      description: 'Ambiente tranquilo en Laureles, ideal para viajes de trabajo.',
      category: 3,
      roomType: 'Estándar',
      pricePerNightMinor: 28_000_000,
      amenities: { wifi: true, breakfast: true, parking: true },
    },
  ],
  'san-andres': [
    {
      name: 'Hotel Decameron Isleño',
      description: 'Resort todo incluido frente al mar con acceso directo a la playa.',
      category: 5,
      roomType: 'Todo incluido',
      pricePerNightMinor: 98_000_000,
      amenities: { wifi: true, pool: true, allInclusive: true, beachAccess: true },
    },
    {
      name: 'Posada Nativa Miss Elma',
      description: 'Posada isleña con atención familiar y cocina local.',
      category: 3,
      roomType: 'Doble',
      pricePerNightMinor: 32_000_000,
      amenities: { wifi: true, breakfast: true, terrace: true },
    },
  ],
  'santa-marta': [
    {
      name: 'Hotel Irotama Resort',
      description: 'Resort junto al mar con varias piscinas y actividades para familias.',
      category: 5,
      roomType: 'Bungalow',
      pricePerNightMinor: 76_000_000,
      amenities: { wifi: true, pool: true, beachAccess: true, kidsClub: true },
    },
    {
      name: 'Casa de Mango',
      description: 'Hotel boutique en el centro histórico, cerca de la bahía.',
      category: 4,
      roomType: 'Doble',
      pricePerNightMinor: 42_000_000,
      amenities: { wifi: true, breakfast: true, rooftop: true },
    },
  ],
  bogota: [
    {
      name: 'Hotel de la Ópera',
      description: 'Casona republicana en La Candelaria, a pasos del teatro Colón y los museos.',
      category: 5,
      roomType: 'Suite',
      pricePerNightMinor: 68_000_000,
      amenities: { wifi: true, breakfast: true, spa: true, library: true },
    },
    {
      name: 'Hotel Bogotá Plaza 100',
      description: 'Hotel urbano con vista a los cerros, ideal para mezclar negocios y cultura.',
      category: 4,
      roomType: 'Doble',
      pricePerNightMinor: 39_000_000,
      amenities: { wifi: true, gym: true, breakfast: true, parking: true },
    },
  ],
  guatape: [
    {
      name: 'Hotel Los Recuerdos',
      description: 'Hotel frente al embalse con muelle propio, piscina y desayuno de montaña.',
      category: 4,
      roomType: 'Doble',
      pricePerNightMinor: 44_000_000,
      amenities: { wifi: true, pool: true, lakeAccess: true, breakfast: true },
    },
    {
      name: 'Finca Hotel El Roble',
      description: 'Finca familiar entre árboles y cafetales, a diez minutos del pueblo.',
      category: 3,
      roomType: 'Familiar',
      pricePerNightMinor: 26_000_000,
      amenities: { wifi: true, breakfast: true, parking: true, fireplace: true },
    },
  ],
};

const activities: Record<string, ActivitySeed[]> = {
  cartagena: [
    {
      name: 'City tour por la ciudad amurallada',
      description: 'Recorrido guiado por la historia, plazas y murallas de Cartagena.',
      intensity: 'LOW',
      durationMinutes: 180,
      pricePerPersonMinor: 12_000_000,
      tags: ['historia', 'cultura'],
    },
    {
      name: 'Islas del Rosario y Barú',
      description: 'Día de playa y snorkel en el archipiélago del Rosario.',
      intensity: 'MEDIUM',
      durationMinutes: 480,
      pricePerPersonMinor: 28_000_000,
      tags: ['playa', 'naturaleza'],
    },
    {
      name: 'Clase de cocina caribeña',
      description: 'Prepara arroz con coco, patacones y ceviche con una cocinera local.',
      intensity: 'LOW',
      durationMinutes: 180,
      pricePerPersonMinor: 18_000_000,
      tags: ['gastronomia', 'cultura'],
    },
    {
      name: 'Kayak al atardecer en la bahía',
      description: 'Remada guiada por la bahía mientras cae el sol sobre el Caribe.',
      intensity: 'MEDIUM',
      durationMinutes: 120,
      pricePerPersonMinor: 9_000_000,
      tags: ['aventura', 'playa'],
    },
  ],
  'eje-cafetero': [
    {
      name: 'Tour de café en finca',
      description: 'Recorrido por el cultivo, beneficio y cata de café de especialidad.',
      intensity: 'LOW',
      durationMinutes: 180,
      pricePerPersonMinor: 9_000_000,
      tags: ['cafe', 'naturaleza'],
    },
    {
      name: 'Valle de Cocora y palmas de cera',
      description: 'Caminata entre las palmas más altas del mundo.',
      intensity: 'MEDIUM',
      durationMinutes: 300,
      pricePerPersonMinor: 14_000_000,
      tags: ['naturaleza', 'aventura'],
    },
    {
      name: 'Cabalgata por el Quindío',
      description: 'Recorrido a caballo por caminos cafeteros y miradores.',
      intensity: 'MEDIUM',
      durationMinutes: 180,
      pricePerPersonMinor: 12_000_000,
      tags: ['aventura', 'naturaleza'],
    },
    {
      name: 'Taller de tejido en Salento',
      description: 'Aprende técnicas artesanales con tejedoras de la región.',
      intensity: 'LOW',
      durationMinutes: 120,
      pricePerPersonMinor: 5_000_000,
      tags: ['cultura', 'artesania'],
    },
  ],
  medellin: [
    {
      name: 'Comuna 13 y grafiti tour',
      description: 'Historia, arte urbano y transformación social en la Comuna 13.',
      intensity: 'LOW',
      durationMinutes: 150,
      pricePerPersonMinor: 8_000_000,
      tags: ['cultura', 'historia'],
    },
    {
      name: 'Parapente en San Félix',
      description: 'Vuelo biplaza con vistas a la ciudad y al valle de Aburrá.',
      intensity: 'HIGH',
      durationMinutes: 180,
      pricePerPersonMinor: 22_000_000,
      tags: ['aventura'],
    },
    {
      name: 'Mercado de la Plaza Minorista',
      description: 'Recorrido gastronómico por frutas, hierbas y cocina antioqueña.',
      intensity: 'LOW',
      durationMinutes: 120,
      pricePerPersonMinor: 6_000_000,
      tags: ['gastronomia', 'cultura'],
    },
    {
      name: 'Ruta de la noche en El Poblado',
      description: 'Coctelería de autor y música en los mejores bares de la ciudad.',
      intensity: 'MEDIUM',
      durationMinutes: 240,
      pricePerPersonMinor: 15_000_000,
      tags: ['vida-nocturna', 'gastronomia'],
    },
  ],
  'san-andres': [
    {
      name: 'Snorkel en Johnny Cay',
      description: 'Navegación y snorkel en un cayo de arena blanca.',
      intensity: 'MEDIUM',
      durationMinutes: 240,
      pricePerPersonMinor: 18_000_000,
      tags: ['playa', 'buceo'],
    },
    {
      name: 'Buceo en arrecife',
      description: 'Inmersión guiada para descubrir la barrera de coral.',
      intensity: 'HIGH',
      durationMinutes: 300,
      pricePerPersonMinor: 32_000_000,
      tags: ['buceo', 'aventura'],
    },
    {
      name: 'Vuelta a la isla en carrito',
      description: 'Recorre a tu ritmo las playas y miradores de San Andrés.',
      intensity: 'LOW',
      durationMinutes: 240,
      pricePerPersonMinor: 10_000_000,
      tags: ['playa'],
    },
    {
      name: 'Cayo Acuario y Haynes Cay',
      description: 'Día de playa, arena blanca y aguas poco profundas.',
      intensity: 'MEDIUM',
      durationMinutes: 300,
      pricePerPersonMinor: 16_000_000,
      tags: ['playa', 'naturaleza'],
    },
  ],
  'santa-marta': [
    {
      name: 'Parque Tayrona y Cabo San Juan',
      description: 'Caminata por senderos de selva hasta una de las playas más icónicas.',
      intensity: 'HIGH',
      durationMinutes: 480,
      pricePerPersonMinor: 24_000_000,
      tags: ['naturaleza', 'playa'],
    },
    {
      name: 'Tubing en Palomino',
      description: 'Descenso por el río entre manglares y selva tropical.',
      intensity: 'MEDIUM',
      durationMinutes: 180,
      pricePerPersonMinor: 9_000_000,
      tags: ['aventura', 'naturaleza'],
    },
    {
      name: 'Tour histórico de Santa Marta',
      description: 'Recorrido por la Quinta de San Pedro Alejandrino y el centro histórico.',
      intensity: 'LOW',
      durationMinutes: 150,
      pricePerPersonMinor: 7_000_000,
      tags: ['historia', 'cultura'],
    },
    {
      name: 'Playa Cristal y bahía de Taganga',
      description: 'Día de playa y snorkel en el Parque Nacional Natural Tayrona.',
      intensity: 'MEDIUM',
      durationMinutes: 360,
      pricePerPersonMinor: 15_000_000,
      tags: ['playa', 'naturaleza'],
    },
  ],
  bogota: [
    {
      name: 'Monserrate y centro histórico',
      description: 'Subida al cerro, mirador de la ciudad y caminata por La Candelaria.',
      intensity: 'LOW',
      durationMinutes: 240,
      pricePerPersonMinor: 12_000_000,
      tags: ['historia', 'cultura', 'ciudad'],
    },
    {
      name: 'Museo del Oro y La Candelaria',
      description: 'Recorrido curado por el oro precolombino, plazas y casas republicanas.',
      intensity: 'LOW',
      durationMinutes: 180,
      pricePerPersonMinor: 9_000_000,
      tags: ['cultura', 'historia'],
    },
    {
      name: 'Ruta gastronómica de Usaquén',
      description: 'Cata de cocina colombiana de autor en el barrio colonial de Usaquén.',
      intensity: 'LOW',
      durationMinutes: 180,
      pricePerPersonMinor: 16_000_000,
      tags: ['gastronomia', 'cultura'],
    },
    {
      name: 'Bogotá en bici por barrios',
      description: 'Pedaleada guiada por parques, murales y mercados locales.',
      intensity: 'MEDIUM',
      durationMinutes: 180,
      pricePerPersonMinor: 7_500_000,
      tags: ['aventura', 'ciudad'],
    },
  ],
  guatape: [
    {
      name: 'Piedra del Peñol y mirador',
      description: 'Subida por las 740 escaleras y panorama completo del embalse.',
      intensity: 'MEDIUM',
      durationMinutes: 180,
      pricePerPersonMinor: 6_000_000,
      tags: ['naturaleza', 'aventura'],
    },
    {
      name: 'Paseo en lancha por el embalse',
      description: 'Navegación entre islas, casas de verano y aguas color esmeralda.',
      intensity: 'LOW',
      durationMinutes: 120,
      pricePerPersonMinor: 9_500_000,
      tags: ['naturaleza', 'descanso'],
    },
    {
      name: 'Calle de los Zócalos a pie',
      description: 'Caminata por las fachadas pintadas y la historia del pueblo.',
      intensity: 'LOW',
      durationMinutes: 120,
      pricePerPersonMinor: 4_000_000,
      tags: ['cultura', 'fotos'],
    },
    {
      name: 'Kayak al amanecer',
      description: 'Remada tranquila por el embalse mientras sale el sol sobre las montañas.',
      intensity: 'MEDIUM',
      durationMinutes: 150,
      pricePerPersonMinor: 11_000_000,
      tags: ['aventura', 'naturaleza'],
    },
  ],
};

const transportOptions: TransportSeed[] = [
  {
    originSlug: 'medellin',
    destinationSlug: 'cartagena',
    mode: 'FLIGHT',
    provider: 'Avianca',
    priceMinor: 45_000_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 90,
  },
  {
    originSlug: 'medellin',
    destinationSlug: 'santa-marta',
    mode: 'FLIGHT',
    provider: 'LATAM',
    priceMinor: 42_000_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 100,
  },
  {
    originSlug: 'medellin',
    destinationSlug: 'san-andres',
    mode: 'FLIGHT',
    provider: 'Avianca',
    priceMinor: 68_000_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 120,
  },
  {
    originSlug: 'medellin',
    destinationSlug: 'eje-cafetero',
    mode: 'BUS',
    provider: 'Flota Occidental',
    priceMinor: 8_500_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 420,
  },
  {
    originSlug: 'cartagena',
    destinationSlug: 'santa-marta',
    mode: 'BUS',
    provider: 'Expreso Brasilia',
    priceMinor: 6_000_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 240,
  },
  {
    originSlug: null,
    destinationSlug: 'cartagena',
    mode: 'CAR_RENTAL',
    provider: 'Localiza',
    priceMinor: 18_000_000,
    pricingUnit: 'PER_DAY',
    durationMinutes: 1440,
  },
  {
    originSlug: null,
    destinationSlug: 'san-andres',
    mode: 'CAR_RENTAL',
    provider: 'Islander Rentals',
    priceMinor: 25_000_000,
    pricingUnit: 'PER_DAY',
    durationMinutes: 1440,
  },
  {
    originSlug: null,
    destinationSlug: 'cartagena',
    mode: 'BOAT',
    provider: 'Lancha Playa Blanca',
    priceMinor: 4_500_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 45,
  },
  {
    originSlug: null,
    destinationSlug: 'santa-marta',
    mode: 'BOAT',
    provider: 'Lancha Taganga',
    priceMinor: 3_500_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 30,
  },
  {
    originSlug: null,
    destinationSlug: 'medellin',
    mode: 'CAR_RENTAL',
    provider: 'Hertz',
    priceMinor: 16_000_000,
    pricingUnit: 'PER_DAY',
    durationMinutes: 1440,
  },
  {
    originSlug: 'medellin',
    destinationSlug: 'bogota',
    mode: 'FLIGHT',
    provider: 'Avianca',
    priceMinor: 52_000_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 95,
  },
  {
    originSlug: 'cartagena',
    destinationSlug: 'bogota',
    mode: 'FLIGHT',
    provider: 'LATAM',
    priceMinor: 48_000_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 100,
  },
  {
    originSlug: 'medellin',
    destinationSlug: 'guatape',
    mode: 'BUS',
    provider: 'Sotrapeñol',
    priceMinor: 3_500_000,
    pricingUnit: 'PER_PERSON',
    durationMinutes: 120,
  },
  {
    originSlug: null,
    destinationSlug: 'bogota',
    mode: 'CAR_RENTAL',
    provider: 'Hertz',
    priceMinor: 20_000_000,
    pricingUnit: 'PER_DAY',
    durationMinutes: 1440,
  },
  {
    originSlug: null,
    destinationSlug: 'guatape',
    mode: 'CAR_RENTAL',
    provider: 'Localiza',
    priceMinor: 16_000_000,
    pricingUnit: 'PER_DAY',
    durationMinutes: 1440,
  },
];

async function seedAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the admin user');
  }

  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await argon2.hash(env.ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: env.ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      id: randomUUID(),
      name: env.ADMIN_NAME,
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Admin user ready: ${user.email}`);
}

async function seedCatalog(): Promise<void> {
  const destinationIds = new Map<string, string>();

  for (const destination of destinations) {
    const heroImageUrl = await resolveImageUrl(`destinations/${destination.slug}`);
    const row = await prisma.destination.upsert({
      where: { slug: destination.slug },
      update: {
        city: destination.city,
        country: destination.country,
        description: destination.description,
        heroImageUrl,
        latitude: destination.latitude,
        longitude: destination.longitude,
        tags: destination.tags,
        isFeatured: destination.isFeatured,
        isActive: true,
      },
      create: {
        id: randomUUID(),
        ...destination,
        heroImageUrl,
        timezone: 'America/Bogota',
        isActive: true,
      },
    });
    destinationIds.set(destination.slug, row.id);
  }

  let hotelCount = 0;
  for (const [slug, items] of Object.entries(hotels)) {
    const destinationId = destinationIds.get(slug);
    if (!destinationId) throw new Error(`Unknown destination slug in seed: ${slug}`);

    for (const hotel of items) {
      const existing = await prisma.hotel.findFirst({
        where: { destinationId, name: hotel.name },
      });
      const imageUrl = await resolveImageUrl(
        `hotels/${slug}/${slugify(hotel.name)}`,
        `destinations/${slug}`,
      );
      const data = { ...hotel, destinationId, currency: 'COP', imageUrl, isActive: true };
      if (existing) {
        await prisma.hotel.update({ where: { id: existing.id }, data });
      } else {
        await prisma.hotel.create({ data: { id: randomUUID(), ...data } });
      }
      hotelCount += 1;
    }
  }

  let activityCount = 0;
  for (const [slug, items] of Object.entries(activities)) {
    const destinationId = destinationIds.get(slug);
    if (!destinationId) throw new Error(`Unknown destination slug in seed: ${slug}`);

    for (const activity of items) {
      const existing = await prisma.activity.findFirst({
        where: { destinationId, name: activity.name },
      });
      const imageUrl = await resolveImageUrl(
        `activities/${slug}/${slugify(activity.name)}`,
        `destinations/${slug}`,
      );
      const data = { ...activity, destinationId, currency: 'COP', imageUrl, isActive: true };
      if (existing) {
        await prisma.activity.update({ where: { id: existing.id }, data });
      } else {
        await prisma.activity.create({ data: { id: randomUUID(), ...data } });
      }
      activityCount += 1;
    }
  }

  let transportCount = 0;
  for (const option of transportOptions) {
    const destinationId = destinationIds.get(option.destinationSlug);
    if (!destinationId) {
      throw new Error(`Unknown destination slug in seed: ${option.destinationSlug}`);
    }
    const originDestinationId = option.originSlug ? destinationIds.get(option.originSlug) : null;
    if (option.originSlug && !originDestinationId) {
      throw new Error(`Unknown origin slug in seed: ${option.originSlug}`);
    }

    const existing = await prisma.transportOption.findFirst({
      where: {
        originDestinationId,
        destinationId,
        mode: option.mode,
        provider: option.provider,
      },
    });
    const imageUrl = await resolveImageUrl(
      `transport/${option.destinationSlug}/${slugify(option.mode)}-${slugify(option.provider)}`,
      `destinations/${option.destinationSlug}`,
    );
    const data = {
      originDestinationId,
      destinationId,
      mode: option.mode,
      provider: option.provider,
      priceMinor: option.priceMinor,
      currency: 'COP',
      imageUrl,
      pricingUnit: option.pricingUnit,
      durationMinutes: option.durationMinutes,
      isActive: true,
    };
    if (existing) {
      await prisma.transportOption.update({ where: { id: existing.id }, data });
    } else {
      await prisma.transportOption.create({ data: { id: randomUUID(), ...data } });
    }
    transportCount += 1;
  }

  console.log(
    `Catalog ready: ${destinations.length} destinations, ${hotelCount} hotels, ${activityCount} activities, ${transportCount} transport options`,
  );
}

async function main(): Promise<void> {
  if (storage) {
    try {
      await storage.ensureBucket();
      console.log(
        `Images: uploading local assets to Supabase Storage bucket "${env.SUPABASE_STORAGE_BUCKET}"`,
      );
    } catch (error) {
      console.warn(
        `Images: Supabase Storage unavailable; image URLs will stay null (${error instanceof Error ? error.message : String(error)})`,
      );
      storage = null;
    }
  } else {
    console.log(
      'Images: Supabase Storage not configured; image URLs stay null and the SPA uses local destination photos',
    );
  }

  await seedAdmin();
  await seedCatalog();
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
