import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import type { ActivityIntensity, PricingUnit, TransportMode } from '@turiviaje/shared';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });

interface DestinationSeed {
  city: string;
  country: string;
  slug: string;
  description: string;
  heroImageUrl: string;
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
  imageUrl: string;
  amenities: Record<string, boolean | string>;
}

interface ActivitySeed {
  name: string;
  description: string;
  intensity: ActivityIntensity;
  durationMinutes: number;
  pricePerPersonMinor: number;
  imageUrl: string;
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
    heroImageUrl: 'https://picsum.photos/seed/turiviaje-cartagena/1600/900',
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
    heroImageUrl: 'https://picsum.photos/seed/turiviaje-eje-cafetero/1600/900',
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
    heroImageUrl: 'https://picsum.photos/seed/turiviaje-medellin/1600/900',
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
    heroImageUrl: 'https://picsum.photos/seed/turiviaje-san-andres/1600/900',
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
    heroImageUrl: 'https://picsum.photos/seed/turiviaje-santa-marta/1600/900',
    latitude: 11.24,
    longitude: -74.199,
    tags: ['playa', 'naturaleza', 'historia', 'aventura'],
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-hotel-san-agustin/1200/800',
      amenities: { wifi: true, pool: true, breakfast: true, spa: true },
    },
    {
      name: 'Hotel Bóvedas de San Pedro',
      description: 'Alojamiento con encanto a pasos de la muralla y la vida nocturna.',
      category: 4,
      roomType: 'Doble',
      pricePerNightMinor: 52_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-hotel-bovedas/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-hotel-mirador/1200/800',
      amenities: { wifi: true, breakfast: true, fireplace: true },
    },
    {
      name: 'Finca Hotel La Rivera',
      description: 'Finca cafetera familiar con recorrido por el cultivo.',
      category: 3,
      roomType: 'Familiar',
      pricePerNightMinor: 24_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-finca-rivera/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-hotel-poblado/1200/800',
      amenities: { wifi: true, pool: true, gym: true, breakfast: true },
    },
    {
      name: 'Hotel Laureles 70',
      description: 'Ambiente tranquilo en Laureles, ideal para viajes de trabajo.',
      category: 3,
      roomType: 'Estándar',
      pricePerNightMinor: 28_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-hotel-laureles/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-hotel-decameron/1200/800',
      amenities: { wifi: true, pool: true, allInclusive: true, beachAccess: true },
    },
    {
      name: 'Posada Nativa Miss Elma',
      description: 'Posada isleña con atención familiar y cocina local.',
      category: 3,
      roomType: 'Doble',
      pricePerNightMinor: 32_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-posada-elma/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-hotel-irotama/1200/800',
      amenities: { wifi: true, pool: true, beachAccess: true, kidsClub: true },
    },
    {
      name: 'Casa de Mango',
      description: 'Hotel boutique en el centro histórico, cerca de la bahía.',
      category: 4,
      roomType: 'Doble',
      pricePerNightMinor: 42_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-casa-mango/1200/800',
      amenities: { wifi: true, breakfast: true, rooftop: true },
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-city-tour/1200/800',
      tags: ['historia', 'cultura'],
    },
    {
      name: 'Islas del Rosario y Barú',
      description: 'Día de playa y snorkel en el archipiélago del Rosario.',
      intensity: 'MEDIUM',
      durationMinutes: 480,
      pricePerPersonMinor: 28_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-rosario/1200/800',
      tags: ['playa', 'naturaleza'],
    },
    {
      name: 'Clase de cocina caribeña',
      description: 'Prepara arroz con coco, patacones y ceviche con una cocinera local.',
      intensity: 'LOW',
      durationMinutes: 180,
      pricePerPersonMinor: 18_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-cocina/1200/800',
      tags: ['gastronomia', 'cultura'],
    },
    {
      name: 'Kayak al atardecer en la bahía',
      description: 'Remada guiada por la bahía mientras cae el sol sobre el Caribe.',
      intensity: 'MEDIUM',
      durationMinutes: 120,
      pricePerPersonMinor: 9_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-kayak/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-tour-cafe/1200/800',
      tags: ['cafe', 'naturaleza'],
    },
    {
      name: 'Valle de Cocora y palmas de cera',
      description: 'Caminata entre las palmas más altas del mundo.',
      intensity: 'MEDIUM',
      durationMinutes: 300,
      pricePerPersonMinor: 14_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-cocora/1200/800',
      tags: ['naturaleza', 'aventura'],
    },
    {
      name: 'Cabalgata por el Quindío',
      description: 'Recorrido a caballo por caminos cafeteros y miradores.',
      intensity: 'MEDIUM',
      durationMinutes: 180,
      pricePerPersonMinor: 12_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-cabalgata/1200/800',
      tags: ['aventura', 'naturaleza'],
    },
    {
      name: 'Taller de tejido en Salento',
      description: 'Aprende técnicas artesanales con tejedoras de la región.',
      intensity: 'LOW',
      durationMinutes: 120,
      pricePerPersonMinor: 5_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-tejido/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-comuna13/1200/800',
      tags: ['cultura', 'historia'],
    },
    {
      name: 'Parapente en San Félix',
      description: 'Vuelo biplaza con vistas a la ciudad y al valle de Aburrá.',
      intensity: 'HIGH',
      durationMinutes: 180,
      pricePerPersonMinor: 22_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-parapente/1200/800',
      tags: ['aventura'],
    },
    {
      name: 'Mercado de la Plaza Minorista',
      description: 'Recorrido gastronómico por frutas, hierbas y cocina antioqueña.',
      intensity: 'LOW',
      durationMinutes: 120,
      pricePerPersonMinor: 6_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-plaza-minorista/1200/800',
      tags: ['gastronomia', 'cultura'],
    },
    {
      name: 'Ruta de la noche en El Poblado',
      description: 'Coctelería de autor y música en los mejores bares de la ciudad.',
      intensity: 'MEDIUM',
      durationMinutes: 240,
      pricePerPersonMinor: 15_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-noche/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-johnny-cay/1200/800',
      tags: ['playa', 'buceo'],
    },
    {
      name: 'Buceo en arrecife',
      description: 'Inmersión guiada para descubrir la barrera de coral.',
      intensity: 'HIGH',
      durationMinutes: 300,
      pricePerPersonMinor: 32_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-buceo/1200/800',
      tags: ['buceo', 'aventura'],
    },
    {
      name: 'Vuelta a la isla en carrito',
      description: 'Recorre a tu ritmo las playas y miradores de San Andrés.',
      intensity: 'LOW',
      durationMinutes: 240,
      pricePerPersonMinor: 10_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-carrito/1200/800',
      tags: ['playa'],
    },
    {
      name: 'Cayo Acuario y Haynes Cay',
      description: 'Día de playa, arena blanca y aguas poco profundas.',
      intensity: 'MEDIUM',
      durationMinutes: 300,
      pricePerPersonMinor: 16_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-acuario/1200/800',
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
      imageUrl: 'https://picsum.photos/seed/turiviaje-tayrona/1200/800',
      tags: ['naturaleza', 'playa'],
    },
    {
      name: 'Tubing en Palomino',
      description: 'Descenso por el río entre manglares y selva tropical.',
      intensity: 'MEDIUM',
      durationMinutes: 180,
      pricePerPersonMinor: 9_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-tubing/1200/800',
      tags: ['aventura', 'naturaleza'],
    },
    {
      name: 'Tour histórico de Santa Marta',
      description: 'Recorrido por la Quinta de San Pedro Alejandrino y el centro histórico.',
      intensity: 'LOW',
      durationMinutes: 150,
      pricePerPersonMinor: 7_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-santa-marta-tour/1200/800',
      tags: ['historia', 'cultura'],
    },
    {
      name: 'Playa Cristal y bahía de Taganga',
      description: 'Día de playa y snorkel en el Parque Nacional Natural Tayrona.',
      intensity: 'MEDIUM',
      durationMinutes: 360,
      pricePerPersonMinor: 15_000_000,
      imageUrl: 'https://picsum.photos/seed/turiviaje-playa-cristal/1200/800',
      tags: ['playa', 'naturaleza'],
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
    const row = await prisma.destination.upsert({
      where: { slug: destination.slug },
      update: {
        city: destination.city,
        country: destination.country,
        description: destination.description,
        heroImageUrl: destination.heroImageUrl,
        latitude: destination.latitude,
        longitude: destination.longitude,
        tags: destination.tags,
        isFeatured: destination.isFeatured,
        isActive: true,
      },
      create: {
        id: randomUUID(),
        ...destination,
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
      const data = { ...hotel, destinationId, currency: 'COP', isActive: true };
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
      const data = { ...activity, destinationId, currency: 'COP', isActive: true };
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
    const data = {
      originDestinationId,
      destinationId,
      mode: option.mode,
      provider: option.provider,
      priceMinor: option.priceMinor,
      currency: 'COP',
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
