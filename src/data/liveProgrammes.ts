import type { AppProgramme } from '@/contexts/AppDataContext';

/**
 * Qurban 1447H / 2026 programmes, as listed on https://alihsangroupsg.com/#/qurban
 * Sections: Australia to Singapore, Australia to Palestine, Yemen/Tarim, Indonesia, Uganda.
 * Bump LIVE_PROGRAMMES_VERSION whenever this list changes so existing browsers re-sync.
 */
export const LIVE_PROGRAMMES_VERSION = 'qurban-1447h-v1';

const QURBAN_DATE = '2026-05-27';

type Seed = Pick<AppProgramme, 'id' | 'name' | 'country' | 'animal_type' | 'price_per_share' | 'distribution_method'> &
  Partial<AppProgramme>;

const seed = (s: Seed): AppProgramme => ({
  slug: s.id.replace(/^prog-/, ''),
  animals_per_share: 1,
  currency: 'SGD',
  shares_available: 0,
  min_quantity: 1,
  is_active: true,
  qurban_date: QURBAN_DATE,
  orders_count: 0,
  ...s,
});

export const LIVE_PROGRAMMES: AppProgramme[] = [
  // Australia to Singapore (doorstep delivery, portion option)
  seed({ id: 'prog-au-sg-lamb',    name: 'Australia to Singapore - Lamb',         country: 'Australia', animal_type: 'lamb',  price_per_share: 345, distribution_method: 'direct_delivery' }),
  seed({ id: 'prog-au-sg-sheep',   name: 'Australia to Singapore - Sheep',        country: 'Australia', animal_type: 'sheep', price_per_share: 330, distribution_method: 'direct_delivery' }),
  seed({ id: 'prog-au-sg-cattle',  name: 'Australia to Singapore - Cattle (1/7)', country: 'Australia', animal_type: 'cow',   price_per_share: 330, distribution_method: 'direct_delivery', animals_per_share: 7 }),
  // Australia to Palestine (distributed to needy families)
  seed({ id: 'prog-au-ps-lamb',    name: 'Australia to Palestine - Lamb',         country: 'Palestine', animal_type: 'lamb',  price_per_share: 355, distribution_method: 'local_distribution' }),
  seed({ id: 'prog-au-ps-sheep',   name: 'Australia to Palestine - Sheep',        country: 'Palestine', animal_type: 'sheep', price_per_share: 335, distribution_method: 'local_distribution' }),
  seed({ id: 'prog-au-ps-cattle',  name: 'Australia to Palestine - Cattle (1/7)', country: 'Palestine', animal_type: 'cow',   price_per_share: 330, distribution_method: 'local_distribution', animals_per_share: 7 }),
  // Yemen / Tarim
  seed({ id: 'prog-ye-goat-m',     name: 'Yemen/Tarim - Goat (M)',                country: 'Yemen',     animal_type: 'goat',  price_per_share: 265, distribution_method: 'local_distribution' }),
  seed({ id: 'prog-ye-goat-l',     name: 'Yemen/Tarim - Goat (L)',                country: 'Yemen',     animal_type: 'goat',  price_per_share: 300, distribution_method: 'local_distribution' }),
  // Indonesia (breeding programme, installment allowed)
  seed({ id: 'prog-id-goat-xl',    name: 'Indonesia - Goat (XL)',                 country: 'Indonesia', animal_type: 'goat',  price_per_share: 290, distribution_method: 'local_distribution' }),
  // Uganda
  seed({ id: 'prog-ug-sheep',      name: 'Uganda - Sheep',                        country: 'Uganda',    animal_type: 'sheep', price_per_share: 165, distribution_method: 'local_distribution' }),
  seed({ id: 'prog-ug-goat',       name: 'Uganda - Goat',                         country: 'Uganda',    animal_type: 'goat',  price_per_share: 165, distribution_method: 'local_distribution' }),
];
