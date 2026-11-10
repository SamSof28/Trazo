const destinationImages: Record<string, string> = {
  cartagena: '/images/destinations/cartagena.webp',
  'eje-cafetero': '/images/destinations/eje-cafetero.webp',
  medellin: '/images/destinations/medellin.webp',
  'san-andres': '/images/destinations/san-andres.webp',
  'santa-marta': '/images/destinations/santa-marta.webp',
  bogota: '/images/destinations/bogota.webp',
  guatape: '/images/destinations/guatape.webp',
};

const placeholderHosts = ['picsum.photos', 'placehold.co', 'via.placeholder.com'];

/**
 * The seed can store development placeholders in the database. The SPA always
 * prefers the curated local photography for the destination it is rendering.
 */
export function isPlaceholderImage(url: string | null | undefined): boolean {
  if (!url) return true;
  return placeholderHosts.some((host) => url.includes(host));
}

export function localDestinationImage(slug: string | null | undefined): string | null {
  return slug ? (destinationImages[slug] ?? null) : null;
}

export function destinationImage(
  slug: string | null | undefined,
  imageUrl: string | null | undefined,
): string | null {
  return localDestinationImage(slug) ?? imageUrl ?? null;
}

/**
 * Hotels, activities and transport have their own image slot, but the seed
 * reuses the destination photo when there is no specific asset yet.
 */
export function catalogItemImage(
  imageUrl: string | null | undefined,
  destinationSlug: string | null | undefined,
): string | null {
  if (imageUrl && !isPlaceholderImage(imageUrl)) return imageUrl;
  return localDestinationImage(destinationSlug);
}
