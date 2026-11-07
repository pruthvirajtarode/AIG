import type { AppProgramme } from '@/contexts/AppDataContext';

/**
 * Qurban 1447H / 2026 programmes, as listed on https://alihsangroupsg.com/#/qurban
 * Sections: Australia to Singapore, Australia to Palestine, Yemen/Tarim, Indonesia (Goat XL + Breeding Programme), Uganda.
 * Bump LIVE_PROGRAMMES_VERSION whenever this list changes so existing browsers re-sync.
 */
export const LIVE_PROGRAMMES_VERSION = 'qurban-1447h-v2';

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
  supports_weight_timeline: false,
  ...s,
});

export const LIVE_PROGRAMMES: AppProgramme[] = [
  // Australia to Singapore (doorstep delivery, per-Qurban portion option; approx weight only)
  seed({ id: 'prog-au-sg-lamb',    name: 'Australia to Singapore - Lamb',         country: 'Australia', animal_type: 'lamb',  price_per_share: 345, distribution_method: 'direct_delivery',    approx_weight_label: 'Approx. 18–22 kg' }),
  seed({ id: 'prog-au-sg-sheep',   name: 'Australia to Singapore - Sheep',        country: 'Australia', animal_type: 'sheep', price_per_share: 330, distribution_method: 'direct_delivery',    approx_weight_label: 'Approx. 25–30 kg' }),
  seed({ id: 'prog-au-sg-cattle',  name: 'Australia to Singapore - Cattle (1/7)', country: 'Australia', animal_type: 'cow',   price_per_share: 330, distribution_method: 'direct_delivery',    animals_per_share: 7, approx_weight_label: 'Approx. 300–350 kg (whole)' }),
  // Australia to Palestine (distributed to needy families; approx weight only)
  seed({ id: 'prog-au-ps-lamb',    name: 'Australia to Palestine - Lamb',         country: 'Palestine', animal_type: 'lamb',  price_per_share: 355, distribution_method: 'local_distribution', approx_weight_label: 'Approx. 18–22 kg' }),
  seed({ id: 'prog-au-ps-sheep',   name: 'Australia to Palestine - Sheep',        country: 'Palestine', animal_type: 'sheep', price_per_share: 335, distribution_method: 'local_distribution', approx_weight_label: 'Approx. 25–30 kg' }),
  seed({ id: 'prog-au-ps-cattle',  name: 'Australia to Palestine - Cattle (1/7)', country: 'Palestine', animal_type: 'cow',   price_per_share: 330, distribution_method: 'local_distribution', animals_per_share: 7, approx_weight_label: 'Approx. 300–350 kg (whole)' }),
  // Yemen / Tarim (approx weight only)
  seed({ id: 'prog-ye-goat-m',     name: 'Yemen/Tarim - Goat (M)',                country: 'Yemen',     animal_type: 'goat',  price_per_share: 265, distribution_method: 'local_distribution', approx_weight_label: 'Approx. 20–25 kg' }),
  seed({ id: 'prog-ye-goat-l',     name: 'Yemen/Tarim - Goat (L)',                country: 'Yemen',     animal_type: 'goat',  price_per_share: 300, distribution_method: 'local_distribution', approx_weight_label: 'Approx. 25–30 kg' }),
  // Indonesia — Goat (XL) (approx weight only; installment allowed)
  seed({ id: 'prog-id-goat-xl',    name: 'Indonesia - Goat (XL)',                 country: 'Indonesia', animal_type: 'goat',  price_per_share: 290, distribution_method: 'local_distribution', approx_weight_label: 'Approx. 35–40 kg' }),
  // Indonesia — Breeding Programme (monthly weight updates / weight timeline enabled; installment allowed)
  seed({ id: 'prog-id-breeding',   name: 'Indonesia - Breeding Programme',        country: 'Indonesia', animal_type: 'goat',  price_per_share: 360, distribution_method: 'local_distribution', supports_weight_timeline: true, approx_weight_label: 'Approx. 25–35 kg (monthly weight updates)' }),
  // Uganda (approx weight only)
  seed({ id: 'prog-ug-sheep',      name: 'Uganda - Sheep',                        country: 'Uganda',    animal_type: 'sheep', price_per_share: 165, distribution_method: 'local_distribution', approx_weight_label: 'Approx. 25–30 kg' }),
  seed({ id: 'prog-ug-goat',       name: 'Uganda - Goat',                         country: 'Uganda',    animal_type: 'goat',  price_per_share: 165, distribution_method: 'local_distribution', approx_weight_label: 'Approx. 22–28 kg' }),
];
