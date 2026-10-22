// Realistic animal photos served from /public.
// Keep this as the single source of truth so every page shows the same imagery.

export const ANIMAL_IMAGES: Record<string, string> = {
  cow:     '/animal-cow.png',
  goat:    '/animal-goat.png',
  sheep:   '/animal-sheep.png',
  lamb:    '/animal-sheep.png',
  camel:   '/animal-camel.png',
  buffalo: '/animal-buffalo.png',
};

const EMOJI_TO_TYPE: Record<string, string> = {
  '🐄': 'cow', '🐐': 'goat', '🐑': 'sheep', '🐪': 'camel', '🐃': 'buffalo',
};

/** Accepts an animal type ('cow'), or a legacy emoji ('🐄'), and returns the photo URL. */
export function getAnimalImage(typeOrEmoji: string | null | undefined): string {
  if (!typeOrEmoji) return ANIMAL_IMAGES.cow;
  const key = EMOJI_TO_TYPE[typeOrEmoji] ?? typeOrEmoji.toLowerCase();
  return ANIMAL_IMAGES[key] ?? ANIMAL_IMAGES.cow;
}
