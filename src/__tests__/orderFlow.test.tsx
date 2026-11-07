import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppDataProvider, useAppData } from '@/contexts/AppDataContext';
import { LIVE_PROGRAMMES } from '@/data/liveProgrammes';
import {
  AUSTRALIA_SINGAPORE_PORTION_OPTIONS,
  OFFICIAL_WHATSAPP_NUMBER,
  ORDER_PAYMENT_OPTIONS,
  ORDER_SERVICE_OPTIONS,
  animalCodeForOrder,
  defaultApproxWeight,
  formatDeliveryPortion,
  formatPaymentMethod,
  formatServiceType,
  isAustraliaToSingaporeProgramme,
  isBreedingProgramme,
  isIndonesiaProgramme,
  normaliseEmail,
  normaliseName,
  normalisePhone,
  participantsMatch,
  summarizeOrderPortions,
  validateOrderCandidate,
} from '@/lib/orderRules';
import { notificationService } from '@/services/notificationService';
import { OrdersPage } from '@/pages/admin/OrdersPage';
import { AnimalsPage } from '@/pages/admin/AnimalsPage';
import { ParticipantsPage } from '@/pages/admin/ParticipantsPage';
import { PaymentsPage } from '@/pages/admin/PaymentsPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { PortalOrdersPage } from '@/pages/portal/PortalOrdersPage';
import { PortalCertificatesPage } from '@/pages/portal/PortalCertificatesPage';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

type CapturedContext = ReturnType<typeof useAppData>;

function mountAppDataStore(): {
  getState: () => CapturedContext;
  remountFromStorage: () => CapturedContext;
  renderScreen: (element: React.ReactElement) => string;
} {
  let latestCtx: CapturedContext | null = null;

  function Consumer() {
    latestCtx = useAppData();
    return null;
  }

  const mountOnce = () => {
    renderToStaticMarkup(
      <AuthProvider>
        <ToastProvider>
          <AppDataProvider>
            <Consumer />
          </AppDataProvider>
        </ToastProvider>
      </AuthProvider>,
    );
    if (!latestCtx) throw new Error('Failed to capture AppDataContext');
    return latestCtx;
  };

  mountOnce();

  const getFreshState = (): CapturedContext => {
    // Re-mounting reads persisted localStorage state (same as reading latest state / refresh)
    return mountOnce();
  };

  const renderScreen = (element: React.ReactElement): string =>
    renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <AppDataProvider>{element}</AppDataProvider>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

  return {
    getState: getFreshState,
    remountFromStorage: mountOnce,
    renderScreen,
  };
}

describe('AIGMS Order Creation, Participant Matching, Dynamic Qurbans & Animal Stock', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  });

  it('loads existing AIG live programmes and classifies Indonesia vs Australia → Singapore accurately', () => {
    const store = mountAppDataStore();
    const state = store.getState();

    expect(state.programmes.length).toBe(LIVE_PROGRAMMES.length);
    expect(state.programmes.map(p => p.name)).toEqual(LIVE_PROGRAMMES.map(p => p.name));

    // Indonesia detection
    expect(isIndonesiaProgramme('Indonesia - Goat (XL)', 'Indonesia')).toBe(true);
    expect(isIndonesiaProgramme('Australia to Singapore - Lamb', 'Australia')).toBe(false);
    expect(isIndonesiaProgramme('Australia to Palestine - Lamb', 'Palestine')).toBe(false);
    expect(isIndonesiaProgramme('Yemen/Tarim - Goat (M)', 'Yemen')).toBe(false);
    expect(isIndonesiaProgramme('Uganda - Sheep', 'Uganda')).toBe(false);

    // Australia → Singapore detection (must exclude Australia → Palestine!)
    expect(isAustraliaToSingaporeProgramme('Australia to Singapore - Lamb', 'Australia')).toBe(true);
    expect(isAustraliaToSingaporeProgramme('Australia to Singapore - Sheep', 'Australia')).toBe(true);
    expect(isAustraliaToSingaporeProgramme('Australia to Singapore - Cattle (1/7)', 'Australia')).toBe(true);
    expect(isAustraliaToSingaporeProgramme('Australia to Palestine - Lamb', 'Palestine')).toBe(false);
    expect(isAustraliaToSingaporeProgramme('Australia to Palestine - Sheep', 'Palestine')).toBe(false);
    expect(isAustraliaToSingaporeProgramme('Indonesia - Goat (XL)', 'Indonesia')).toBe(false);
  });

  it('TEST 1: New participant + 1 Qurban creates 1 participant, 1 order, 1 Order Reference, 1 animal, 1 Animal Code', () => {
    const store = mountAppDataStore();
    const ctx = store.getState();

    const created = ctx.addOrder({
      order_ref: 'ORD-10001',
      full_name: 'Ahmad Rizal',
      email: 'ahmad.rizal@example.com',
      contact_number: '+65 9123 4567',
      programme: 'Yemen/Tarim - Goat (M)',
      programme_id: 'prog-live-07',
      programme_country: 'Yemen',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: null,
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Ahmad Rizal' }],
      total_amount: 245,
      currency: 'SGD',
    });

    const next = store.getState();
    expect(created.order_ref).toBe('ORD-10001');
    expect(next.participants).toHaveLength(1);
    expect(next.participants[0].portal_access).toBe(true);
    expect(next.participants[0].full_name).toBe('Ahmad Rizal');

    expect(next.orders).toHaveLength(1);
    expect(next.orders[0].order_ref).toBe('ORD-10001');
    expect(next.orders[0].participant_id).toBe(next.participants[0].id);

    expect(next.animals).toHaveLength(1);
    expect(next.animals[0].animal_code).toBe('ANM-10001-01');
    expect(next.animals[0].animal_ref).toBe('ANM-10001-01');
    expect(next.animals[0].order_ref).toBe('ORD-10001');
    expect(next.animals[0].order_id).toBe(created.id);
    expect(next.animals[0].qurban_name_holder).toBe('Ahmad Rizal');
    expect(next.animals[0].programme).toBe('Yemen/Tarim - Goat (M)');
    expect(next.animals[0].status).toBe('reserved');

    expect(next.payments).toHaveLength(1);
    expect(next.payments[0].order_ref).toBe('ORD-10001');
  });

  it('TEST 2: Existing participant + 1 Qurban reuses existing participant (with normalized name/email/phone) without duplicates', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    const firstOrder = ctx.addOrder({
      order_ref: 'ORD-10010',
      full_name: 'Siti Aminah Binte Hassan',
      email: 'Siti.Aminah@Example.com',
      contact_number: '+65 8123-4567',
      programme: 'Uganda - Goat',
      programme_id: 'prog-live-11',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: null,
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Siti Aminah Binte Hassan' }],
      total_amount: 195,
      currency: 'SGD',
    });

    ctx = store.getState();
    // Second order for the SAME participant with spacing/casing/+65 variations
    const secondOrder = ctx.addOrder({
      order_ref: 'ORD-10011',
      full_name: '  siti   aminah binte hassan ',
      email: 'siti.aminah@example.com ',
      contact_number: '81234567', // Local 8-digit SG format matches +65 8123-4567
      programme: 'Uganda - Sheep',
      programme_id: 'prog-live-10',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'cash',
      delivery_portion: null,
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Hassan Bin Omar' }],
      total_amount: 195,
      currency: 'SGD',
    });

    const next = store.getState();
    expect(normaliseName('  Siti  Aminah ')).toBe('siti aminah');
    expect(normaliseEmail(' Siti.Aminah@Example.com ')).toBe('siti.aminah@example.com');
    expect(normalisePhone('+65 8123-4567')).toBe(normalisePhone('81234567'));
    expect(
      participantsMatch(
        { full_name: 'siti aminah binte hassan', email: 'siti.aminah@example.com', contact_number: '81234567' },
        next.participants[0],
      ),
    ).toBe(true);

    // Existing participant reused — ZERO duplicate participant!
    expect(next.participants).toHaveLength(1);
    expect(secondOrder.participant_id).toBe(firstOrder.participant_id);
    expect(next.orders).toHaveLength(2);
    expect(next.animals).toHaveLength(2);
    expect(next.animals.map(a => a.animal_code).sort()).toEqual(['ANM-10010-01', 'ANM-10011-01']);
  });

  it('TEST 3: New participant + 2 Qurbans creates 1 order (ORD-10025) and 2 distinct animals sharing ORD-10025; blocks missing 2nd holder', () => {
    const store = mountAppDataStore();
    const ctx = store.getState();

    // Validation must block Number of Qurbans = 2 when only 1 Qurban Name Holder is entered
    expect(() =>
      ctx.addOrder({
        order_ref: 'ORD-10025',
        full_name: 'Muhammad Farhan',
        email: 'farhan@example.com',
        contact_number: '+65 9222 3333',
        programme: 'Yemen/Tarim - Goat (L)',
        programme_id: 'prog-live-08',
        programme_country: 'Yemen',
        service_type: 'qurban',
        payment_method: 'paynow',
        delivery_portion: null,
        quantity: 2,
        qurban_entries: [{ qurban_name_holder: 'Person A' }, { qurban_name_holder: '   ' }],
        total_amount: 550,
        currency: 'SGD',
      }),
    ).toThrow(/Qurban 2/i);

    const order = ctx.addOrder({
      order_ref: 'ORD-10025',
      full_name: 'Muhammad Farhan',
      email: 'farhan@example.com',
      contact_number: '+65 9222 3333',
      programme: 'Yemen/Tarim - Goat (L)',
      programme_id: 'prog-live-08',
      programme_country: 'Yemen',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: null,
      quantity: 2,
      qurban_entries: [{ qurban_name_holder: 'Person A' }, { qurban_name_holder: 'Person B' }],
      total_amount: 550,
      currency: 'SGD',
    });

    const next = store.getState();
    expect(next.participants).toHaveLength(1);
    expect(next.orders).toHaveLength(1);
    expect(order.order_ref).toBe('ORD-10025');
    expect(order.quantity).toBe(2);

    const linkedAnimals = next.animals
      .filter(a => a.order_ref === 'ORD-10025')
      .sort((a, b) => (a.animal_code ?? '').localeCompare(b.animal_code ?? ''));

    expect(linkedAnimals).toHaveLength(2);
    expect(linkedAnimals[0].animal_code).toBe('ANM-10025-01');
    expect(linkedAnimals[0].qurban_name_holder).toBe('Person A');
    expect(linkedAnimals[0].order_ref).toBe('ORD-10025');

    expect(linkedAnimals[1].animal_code).toBe('ANM-10025-02');
    expect(linkedAnimals[1].qurban_name_holder).toBe('Person B');
    expect(linkedAnimals[1].order_ref).toBe('ORD-10025');
  });

  it('TEST 4: New participant + 3 (and 5) Qurbans dynamically creates 3 (and 5) unique Animal Codes under the same Order Reference', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    ctx.addOrder({
      order_ref: 'ORD-10030',
      full_name: 'Nurul Huda',
      email: 'nurul.huda@example.com',
      contact_number: '+65 9333 4444',
      programme: 'Australia to Palestine - Sheep',
      programme_id: 'prog-live-05',
      programme_country: 'Palestine',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: null,
      quantity: 3,
      qurban_entries: [
        { qurban_name_holder: 'Holder One' },
        { qurban_name_holder: 'Holder Two' },
        { qurban_name_holder: 'Holder Three' },
      ],
      total_amount: 1125,
      currency: 'SGD',
    });

    ctx = store.getState();
    ctx.addOrder({
      order_ref: 'ORD-10031',
      full_name: 'Zulkifli Ibrahim',
      email: 'zul@example.com',
      contact_number: '+65 9444 5555',
      programme: 'Uganda - Goat',
      programme_id: 'prog-live-11',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'cash',
      delivery_portion: null,
      quantity: 5,
      qurban_entries: [
        { qurban_name_holder: 'Entry 1' },
        { qurban_name_holder: 'Entry 2' },
        { qurban_name_holder: 'Entry 3' },
        { qurban_name_holder: 'Entry 4' },
        { qurban_name_holder: 'Entry 5' },
      ],
      total_amount: 975,
      currency: 'SGD',
    });

    const next = store.getState();
    expect(next.orders).toHaveLength(2);

    const threeAnimals = next.animals
      .filter(a => a.order_ref === 'ORD-10030')
      .sort((a, b) => (a.animal_code ?? '').localeCompare(b.animal_code ?? ''));
    expect(threeAnimals).toHaveLength(3);
    expect(threeAnimals.map(a => a.animal_code)).toEqual(['ANM-10030-01', 'ANM-10030-02', 'ANM-10030-03']);
    expect(threeAnimals.map(a => a.qurban_name_holder)).toEqual(['Holder One', 'Holder Two', 'Holder Three']);
    expect(new Set(threeAnimals.map(a => a.order_ref))).toEqual(new Set(['ORD-10030']));

    const fiveAnimals = next.animals
      .filter(a => a.order_ref === 'ORD-10031')
      .sort((a, b) => (a.animal_code ?? '').localeCompare(b.animal_code ?? ''));
    expect(fiveAnimals).toHaveLength(5);
    expect(fiveAnimals.map(a => a.animal_code)).toEqual([
      'ANM-10031-01',
      'ANM-10031-02',
      'ANM-10031-03',
      'ANM-10031-04',
      'ANM-10031-05',
    ]);
  });

  it('TEST 5: Indonesia + Installment is available and submits cleanly', () => {
    const store = mountAppDataStore();
    const ctx = store.getState();

    const indonesiaProg = ctx.programmes.find(p => p.name === 'Indonesia - Goat (XL)')!;
    expect(indonesiaProg).toBeDefined();

    const visibleMethods = ORDER_PAYMENT_OPTIONS.filter(
      opt => !opt.indonesiaOnly || isIndonesiaProgramme(indonesiaProg.name, indonesiaProg.country),
    ).map(o => o.value);
    expect(visibleMethods).toEqual(['paynow', 'cash', 'installment']);

    const order = ctx.addOrder({
      order_ref: 'ORD-10050',
      full_name: 'Hendra Wijaya',
      email: 'hendra@example.com',
      contact_number: '+65 9555 6666',
      programme: indonesiaProg.name,
      programme_id: indonesiaProg.id,
      programme_country: indonesiaProg.country,
      service_type: 'qurban',
      payment_method: 'installment',
      delivery_portion: null,
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Hendra Wijaya' }],
      total_amount: indonesiaProg.price_per_share,
      currency: indonesiaProg.currency,
    });

    const next = store.getState();
    expect(order.payment_method).toBe('installment');
    expect(formatPaymentMethod(order.payment_method)).toBe('Installment');
    expect(next.payments[0].method).toBe('installment');
    expect(next.animals[0].programme).toBe('Indonesia - Goat (XL)');
  });

  it('TEST 6: Non-Indonesia + Installment is unavailable in UI options and blocked in validation/backend', () => {
    const store = mountAppDataStore();
    const ctx = store.getState();

    const nonIndonesiaProgrammes = ctx.programmes.filter(p => !isIndonesiaProgramme(p.name, p.country));
    expect(nonIndonesiaProgrammes.length).toBeGreaterThanOrEqual(10);

    for (const prog of nonIndonesiaProgrammes) {
      const visibleMethods = ORDER_PAYMENT_OPTIONS.filter(
        opt => !opt.indonesiaOnly || isIndonesiaProgramme(prog.name, prog.country),
      ).map(o => o.value);
      expect(visibleMethods).toEqual(['paynow', 'cash']);

      expect(() =>
        ctx.addOrder({
          order_ref: `ORD-BLOCK-${prog.id}`,
          full_name: 'Test Buyer',
          email: 'buyer@example.com',
          contact_number: '+65 9666 7777',
          programme: prog.name,
          programme_id: prog.id,
          programme_country: prog.country,
          service_type: 'qurban',
          payment_method: 'installment',
          delivery_portion: isAustraliaToSingaporeProgramme(prog.name, prog.country) ? 'full' : null,
          quantity: 1,
          qurban_entries: [{ qurban_name_holder: 'Test Buyer' }],
          total_amount: prog.price_per_share,
          currency: prog.currency,
        }),
      ).toThrow(/Installment is only available for Indonesia/i);
    }

    expect(store.getState().orders).toHaveLength(0);
    expect(store.getState().animals).toHaveLength(0);
  });

  it('TEST 7: Australia → Singapore requires Portion (Full, 1/3, 2/3, NIL) and hides/clears it for other routes', () => {
    expect(AUSTRALIA_SINGAPORE_PORTION_OPTIONS.map(o => o.label)).toEqual(['Full', '1/3', '2/3', 'NIL']);

    const store = mountAppDataStore();
    let ctx = store.getState();
    const auSgLamb = ctx.programmes.find(p => p.name === 'Australia to Singapore - Lamb')!;

    // Missing portion on Australia → Singapore must fail validation
    expect(() =>
      ctx.addOrder({
        order_ref: 'ORD-AUSG-ERR',
        full_name: 'Aisyah Malik',
        email: 'aisyah@example.com',
        contact_number: '+65 9777 8888',
        programme: auSgLamb.name,
        programme_id: auSgLamb.id,
        programme_country: auSgLamb.country,
        service_type: 'qurban',
        payment_method: 'paynow',
        delivery_portion: null,
        quantity: 1,
        qurban_entries: [{ qurban_name_holder: 'Aisyah Malik' }],
        total_amount: auSgLamb.price_per_share,
        currency: auSgLamb.currency,
      }),
    ).toThrow(/Portion to be Delivered/i);

    const portions = [
      { value: 'full' as const, label: 'Full', ref: 'ORD-AUSG-01' },
      { value: 'one_third' as const, label: '1/3', ref: 'ORD-AUSG-02' },
      { value: 'two_thirds' as const, label: '2/3', ref: 'ORD-AUSG-03' },
      { value: 'nil' as const, label: 'NIL', ref: 'ORD-AUSG-04' },
    ];

    for (const p of portions) {
      ctx = store.getState();
      const created = ctx.addOrder({
        order_ref: p.ref,
        full_name: 'Aisyah Malik',
        email: 'aisyah@example.com',
        contact_number: '+65 9777 8888',
        programme: auSgLamb.name,
        programme_id: auSgLamb.id,
        programme_country: auSgLamb.country,
        service_type: 'qurban',
        payment_method: 'paynow',
        delivery_portion: p.value,
        quantity: 1,
        qurban_entries: [{ qurban_name_holder: `Holder ${p.label}` }],
        total_amount: auSgLamb.price_per_share,
        currency: auSgLamb.currency,
      });
      expect(created.delivery_portion).toBe(p.value);
      expect(formatDeliveryPortion(created.delivery_portion)).toBe(p.label);
      const animal = store.getState().animals.find(a => a.order_ref === p.ref)!;
      expect(animal.delivery_portion).toBe(p.value);
    }

    // Australia to Palestine must NOT retain delivery_portion
    ctx = store.getState();
    const auPal = ctx.programmes.find(p => p.name === 'Australia to Palestine - Lamb')!;
    const palOrder = ctx.addOrder({
      order_ref: 'ORD-AUPAL-01',
      full_name: 'Aisyah Malik',
      email: 'aisyah@example.com',
      contact_number: '+65 9777 8888',
      programme: auPal.name,
      programme_id: auPal.id,
      programme_country: auPal.country,
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: 'full',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Palestine Holder' }],
      total_amount: auPal.price_per_share,
      currency: auPal.currency,
    });
    expect(palOrder.delivery_portion).toBeNull();
  });

  it('TEST 8 & TEST 9: Service Type supports Qurban and Aqiqah across order and animal records', () => {
    expect(ORDER_SERVICE_OPTIONS.map(o => o.label)).toEqual(['Qurban', 'Aqiqah']);

    const store = mountAppDataStore();
    let ctx = store.getState();

    // TEST 8: Qurban service
    const qurbanOrder = ctx.addOrder({
      order_ref: 'ORD-SRV-QURBAN',
      full_name: 'Imran Yusuf',
      email: 'imran@example.com',
      contact_number: '+65 9888 1111',
      programme: 'Yemen/Tarim - Goat (M)',
      programme_id: 'prog-live-07',
      programme_country: 'Yemen',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: null,
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Imran Yusuf' }],
      total_amount: 245,
      currency: 'SGD',
    });

    // TEST 9: Aqiqah service (including Australia → Singapore with 2/3 portion)
    ctx = store.getState();
    const aqiqahOrder = ctx.addOrder({
      order_ref: 'ORD-SRV-AQIQAH',
      full_name: 'Nadia Karim',
      email: 'nadia@example.com',
      contact_number: '+65 9888 2222',
      programme: 'Australia to Singapore - Sheep',
      programme_id: 'prog-live-02',
      programme_country: 'Australia',
      service_type: 'aqiqah',
      payment_method: 'cash',
      delivery_portion: 'two_thirds',
      quantity: 2,
      qurban_entries: [{ qurban_name_holder: 'Baby Adam Karim (1)' }, { qurban_name_holder: 'Baby Adam Karim (2)' }],
      total_amount: 730,
      currency: 'SGD',
    });

    const next = store.getState();
    expect(qurbanOrder.service_type).toBe('qurban');
    expect(formatServiceType(qurbanOrder.service_type)).toBe('Qurban');
    expect(next.animals.find(a => a.order_ref === 'ORD-SRV-QURBAN')?.service_type).toBe('qurban');

    expect(aqiqahOrder.service_type).toBe('aqiqah');
    expect(formatServiceType(aqiqahOrder.service_type)).toBe('Aqiqah');
    const aqiqahAnimals = next.animals.filter(a => a.order_ref === 'ORD-SRV-AQIQAH');
    expect(aqiqahAnimals).toHaveLength(2);
    expect(aqiqahAnimals.every(a => a.service_type === 'aqiqah')).toBe(true);
    expect(aqiqahAnimals.every(a => a.delivery_portion === 'two_thirds')).toBe(true);
  });

  it('TEST 10: Refresh, duplicate submission, order edit, payment verification & participant update create ZERO duplicates', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    // 1. Initial submission with client_request_id
    const first = ctx.addOrder({
      order_ref: 'ORD-10099',
      client_request_id: 'req-idempotent-10099',
      full_name: 'Khalid Rahman',
      email: 'khalid@example.com',
      contact_number: '+65 9000 1234',
      programme: 'Indonesia - Goat (XL)',
      programme_id: 'prog-live-09',
      programme_country: 'Indonesia',
      service_type: 'qurban',
      payment_method: 'installment',
      delivery_portion: null,
      quantity: 2,
      qurban_entries: [{ qurban_name_holder: 'Khalid A' }, { qurban_name_holder: 'Khalid B' }],
      total_amount: 550,
      currency: 'SGD',
    });

    // 2. Accidental duplicate submission with SAME client_request_id returns existing order (no duplicates)
    ctx = store.getState();
    const replay = ctx.addOrder({
      order_ref: 'ORD-10099',
      client_request_id: 'req-idempotent-10099',
      full_name: 'Khalid Rahman',
      email: 'khalid@example.com',
      contact_number: '+65 9000 1234',
      programme: 'Indonesia - Goat (XL)',
      programme_id: 'prog-live-09',
      programme_country: 'Indonesia',
      service_type: 'qurban',
      payment_method: 'installment',
      delivery_portion: null,
      quantity: 2,
      qurban_entries: [{ qurban_name_holder: 'Khalid A' }, { qurban_name_holder: 'Khalid B' }],
      total_amount: 550,
      currency: 'SGD',
    });
    expect(replay.id).toBe(first.id);

    // 3. Duplicate Order Reference with a DIFFERENT request ID is rejected cleanly
    expect(() =>
      ctx.addOrder({
        order_ref: 'ORD-10099',
        client_request_id: 'req-different-id',
        full_name: 'Khalid Rahman',
        email: 'khalid@example.com',
        contact_number: '+65 9000 1234',
        programme: 'Indonesia - Goat (XL)',
        programme_id: 'prog-live-09',
        programme_country: 'Indonesia',
        service_type: 'qurban',
        payment_method: 'installment',
        delivery_portion: null,
        quantity: 2,
        qurban_entries: [{ qurban_name_holder: 'Khalid A' }, { qurban_name_holder: 'Khalid B' }],
        total_amount: 550,
        currency: 'SGD',
      }),
    ).toThrow(/already exists/i);

    // 4. Simulated page refresh from localStorage
    ctx = store.remountFromStorage();
    expect(ctx.participants).toHaveLength(1);
    expect(ctx.orders).toHaveLength(1);
    expect(ctx.animals).toHaveLength(2);
    expect(ctx.payments).toHaveLength(1);

    // 5. Payment verification updates status without creating duplicate animals
    ctx.verifyPayment(ctx.payments[0].id);
    ctx = store.remountFromStorage();
    expect(ctx.orders[0].status).toBe('payment_verified');
    expect(ctx.payments[0].status).toBe('verified');
    expect(ctx.animals).toHaveLength(2);

    // 6. Order edit (updating holder names in-place) creates ZERO duplicate animals
    ctx.updateOrder(first.id, {
      qurban_entries: [{ qurban_name_holder: 'Khalid Updated 1' }, { qurban_name_holder: 'Khalid Updated 2' }],
    });
    ctx = store.remountFromStorage();
    expect(ctx.animals).toHaveLength(2);
    expect(ctx.animals.map(a => a.qurban_name_holder).sort()).toEqual(['Khalid Updated 1', 'Khalid Updated 2']);

    // 7. Participant info update propagates without creating duplicate animals or participants
    ctx.updateParticipant(ctx.participants[0].id, {
      phone: '+65 9000 9999',
      contact_number: '+65 9000 9999',
    });
    ctx = store.remountFromStorage();
    expect(ctx.participants).toHaveLength(1);
    expect(ctx.orders[0].contact_number).toBe('+65 9000 9999');
    expect(ctx.animals).toHaveLength(2);
  });

  it('renders Order List, Animal Stock, Participants, Payments, and Dashboard cleanly with consistent Order Reference & Animal Codes', () => {
    const store = mountAppDataStore();
    const ctx = store.getState();

    ctx.addOrder({
      order_ref: 'ORD-10025',
      full_name: 'Fatimah Zahra',
      email: 'fatimah@example.com',
      contact_number: '+65 8765 4321',
      programme: 'Australia to Singapore - Lamb',
      programme_id: 'prog-live-01',
      programme_country: 'Australia',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: 'one_third',
      quantity: 2,
      qurban_entries: [{ qurban_name_holder: 'Person A' }, { qurban_name_holder: 'Person B' }],
      total_amount: 760,
      currency: 'SGD',
    });

    expect(animalCodeForOrder('ORD-10025', 0)).toBe('ANM-10025-01');
    expect(animalCodeForOrder('ORD-10025', 1)).toBe('ANM-10025-02');
    expect(
      validateOrderCandidate({
        order_ref: 'ORD-99999',
        full_name: 'Valid User',
        email: 'valid@example.com',
        contact_number: '91234567',
        programme: 'Indonesia - Goat (XL)',
        programme_country: 'Indonesia',
        service_type: 'qurban',
        payment_method: 'installment',
        delivery_portion: null,
        quantity: 1,
        total_amount: 275,
        qurban_entries: [{ qurban_name_holder: 'Valid User' }],
      }).valid,
    ).toBe(true);

    const ordersHtml = store.renderScreen(<OrdersPage />);
    expect(ordersHtml).toContain('ORD-10025');
    expect(ordersHtml).toContain('Fatimah Zahra');
    expect(ordersHtml).toContain('Australia to Singapore - Lamb');
    expect(ordersHtml).toContain('Qurban');
    expect(ordersHtml).toContain('PayNow');

    const animalsHtml = store.renderScreen(<AnimalsPage />);
    expect(animalsHtml).toContain('ANM-10025-01');
    expect(animalsHtml).toContain('ANM-10025-02');
    expect(animalsHtml).toContain('ORD-10025');
    expect(animalsHtml).toContain('Person A');
    expect(animalsHtml).toContain('Person B');
    expect(animalsHtml).toContain('Australia to Singapore - Lamb');

    const participantsHtml = store.renderScreen(<ParticipantsPage />);
    expect(participantsHtml).toContain('Fatimah Zahra');
    expect(participantsHtml).toContain('fatimah@example.com');

    const paymentsHtml = store.renderScreen(<PaymentsPage />);
    expect(paymentsHtml).toContain('ORD-10025');
    expect(paymentsHtml).toContain('PayNow');

    const dashboardHtml = store.renderScreen(<DashboardPage />);
    expect(dashboardHtml).toContain('ORD-10025');
    expect(dashboardHtml).toContain('Fatimah Zahra');
  });

  it('TEST 11: Per-Qurban Portion to be Delivered allows each Qurban 1..N to select its own portion independently', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();
    const auSgLamb = ctx.programmes.find(p => p.name === 'Australia to Singapore - Lamb')!;

    // Missing portion on Qurban 2 when no order-level fallback is passed must fail validation
    expect(() =>
      ctx.addOrder({
        order_ref: 'ORD-PERQ-ERR',
        full_name: 'Yusuf Mansur',
        email: 'yusuf@example.com',
        contact_number: '+65 9111 2222',
        programme: auSgLamb.name,
        programme_id: auSgLamb.id,
        programme_country: auSgLamb.country,
        service_type: 'qurban',
        payment_method: 'paynow',
        delivery_portion: null,
        quantity: 2,
        qurban_entries: [
          { qurban_name_holder: 'Holder 1', delivery_portion: 'two_thirds' },
          { qurban_name_holder: 'Holder 2', delivery_portion: null },
        ],
        total_amount: auSgLamb.price_per_share * 2,
        currency: auSgLamb.currency,
      }),
    ).toThrow(/required for Qurban 2/i);

    // 3 Qurbans with 3 distinct portions under the same Order Reference
    ctx = store.getState();
    const order = ctx.addOrder({
      order_ref: 'ORD-PERQ-03',
      full_name: 'Yusuf Mansur',
      email: 'yusuf@example.com',
      contact_number: '+65 9111 2222',
      programme: auSgLamb.name,
      programme_id: auSgLamb.id,
      programme_country: auSgLamb.country,
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: 'two_thirds',
      quantity: 3,
      qurban_entries: [
        { qurban_name_holder: 'abc', delivery_portion: 'two_thirds' },
        { qurban_name_holder: 'def', delivery_portion: 'full' },
        { qurban_name_holder: 'ghi', delivery_portion: 'nil' },
      ],
      total_amount: auSgLamb.price_per_share * 3,
      currency: auSgLamb.currency,
    });

    const next = store.getState();
    const linked = next.animals
      .filter(a => a.order_ref === order.order_ref)
      .sort((a, b) => (a.animal_code ?? '').localeCompare(b.animal_code ?? ''));

    expect(linked).toHaveLength(3);
    expect(linked.map(a => a.animal_code)).toEqual(['ANM-PERQ-03-01', 'ANM-PERQ-03-02', 'ANM-PERQ-03-03']);
    expect(linked.map(a => a.delivery_portion)).toEqual(['two_thirds', 'full', 'nil']);
    expect(summarizeOrderPortions(linked.map(a => a.delivery_portion), order.delivery_portion)).toBe(
      'Qurban 1: 2/3 · Qurban 2: Full · Qurban 3: NIL',
    );
  });

  it('TEST 12: Indonesia - Breeding Programme shows Weight Timeline & allows Installment, while standard programmes show Approx. Weight only', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    expect(LIVE_PROGRAMMES).toHaveLength(12);
    const breedingProg = ctx.programmes.find(p => p.id === 'prog-id-breeding')!;
    expect(breedingProg).toBeDefined();
    expect(breedingProg.name).toBe('Indonesia - Breeding Programme');
    expect(isIndonesiaProgramme(breedingProg.name, breedingProg.country)).toBe(true);
    expect(isBreedingProgramme(breedingProg.name, breedingProg.supports_weight_timeline)).toBe(true);

    // All 11 standard programmes must NOT enable weight timeline
    const standardProgs = ctx.programmes.filter(p => p.id !== 'prog-id-breeding');
    expect(standardProgs).toHaveLength(11);
    for (const p of standardProgs) {
      expect(isBreedingProgramme(p.name, p.supports_weight_timeline)).toBe(false);
    }

    // Create 1 standard Uganda - Goat order and 1 Indonesia - Breeding Programme order
    ctx.addOrder({
      order_ref: 'ORD-STD-UG',
      full_name: 'Standard Buyer',
      email: 'std@example.com',
      contact_number: '+65 9222 1111',
      programme: 'Uganda - Goat',
      programme_id: 'prog-ug-goat',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Standard Holder' }],
      total_amount: 165,
      currency: 'SGD',
    });

    ctx = store.getState();
    const animalsHtmlStandardOnly = store.renderScreen(<AnimalsPage />);
    expect(animalsHtmlStandardOnly).toContain('Approx. Weight');
    expect(animalsHtmlStandardOnly).toContain(defaultApproxWeight('Uganda - Goat', 'goat'));
    expect(animalsHtmlStandardOnly).not.toContain('Weight Timeline');

    // Now create Indonesia - Breeding Programme order with Installment & log weight update
    ctx.addOrder({
      order_ref: 'ORD-BREED-01',
      full_name: 'Breeding Buyer',
      email: 'breed@example.com',
      contact_number: '+65 9333 2222',
      programme: breedingProg.name,
      programme_id: breedingProg.id,
      programme_country: breedingProg.country,
      service_type: 'qurban',
      payment_method: 'installment',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Breeding Holder' }],
      total_amount: breedingProg.price_per_share,
      currency: breedingProg.currency,
    });

    ctx = store.getState();
    const breedingAnimal = ctx.animals.find(a => a.order_ref === 'ORD-BREED-01')!;
    ctx.updateAnimal(breedingAnimal.id, { current_weight_kg: 28.5 });

    const afterWeight = store.getState();
    const updatedAnimal = afterWeight.animals.find(a => a.id === breedingAnimal.id)!;
    expect(updatedAnimal.current_weight_kg).toBe(28.5);
    expect(updatedAnimal.weight_history).toHaveLength(1);
    expect(updatedAnimal.weight_history?.[0].weight_kg).toBe(28.5);

    const animalsHtmlWithBreeding = store.renderScreen(<AnimalsPage />);
    expect(animalsHtmlWithBreeding).toContain('Weight Timeline');
    expect(animalsHtmlWithBreeding).toContain('28.5kg');
  });

  it('TEST 13: WhatsApp (+6585456783) primary + automatic Email fallback + one-time Email invoice + Portal Certificate PDF download', async () => {
    expect(OFFICIAL_WHATSAPP_NUMBER).toBe('+6585456783');
    expect(notificationService.officialWhatsAppSender).toBe('+6585456783');

    const sentWhatsApps: Array<{ to: string; body: string }> = [];
    const sentEmails: Array<{ to: string; subject: string; body: string }> = [];

    // 1. Both WhatsApp and Email succeed -> WhatsApp primary used, no fallback needed
    notificationService.setProviders({
      whatsapp: {
        name: 'test-whatsapp',
        send: async p => {
          sentWhatsApps.push({ to: p.recipient.phone ?? '', body: p.body });
          return { success: true, channelUsed: 'whatsapp', providerRef: 'wa-ok-1' };
        },
      },
      email: {
        name: 'test-email',
        send: async p => {
          sentEmails.push({ to: p.recipient.email ?? '', subject: p.subject ?? '', body: p.body });
          return { success: true, channelUsed: 'email', providerRef: 'em-ok-1' };
        },
      },
    });

    const primaryRes = await notificationService.notifyQurbanStatusUpdate({
      recipient: { name: 'Ali', email: 'ali@example.com', phone: '+65 9876 5432' },
      orderRef: 'ORD-WA-01',
      programme: 'Uganda - Goat',
      statusLabel: 'Animal Allocated',
    });
    expect(primaryRes.channelUsed).toBe('whatsapp');
    expect(primaryRes.fallbackUsed).toBe(false);
    expect(sentWhatsApps).toHaveLength(1);
    expect(sentEmails).toHaveLength(0);

    // 2. Simulate WhatsApp delivery failure -> automatic Email fallback triggers!
    notificationService.setProviders({
      whatsapp: {
        name: 'test-whatsapp-fail',
        send: async () => ({ success: false, error: 'Meta Cloud API timeout' }),
      },
      email: {
        name: 'test-email',
        send: async p => {
          sentEmails.push({ to: p.recipient.email ?? '', subject: p.subject ?? '', body: p.body });
          return { success: true, channelUsed: 'email', providerRef: 'em-fallback-1' };
        },
      },
    });

    const certFallbackRes = await notificationService.notifyCertificateReady({
      recipient: { name: 'Ali', email: 'ali@example.com', phone: '+65 9876 5432' },
      orderRef: 'ORD-WA-01',
      certificateRef: 'CERT-2026-00001',
      programme: 'Uganda - Goat',
    });
    expect(certFallbackRes.channelUsed).toBe('email');
    expect(certFallbackRes.fallbackUsed).toBe(true);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].body).toContain('/portal/certificates');

    // 3. Order creation stamps confirmation_email_sent_at once & Portal screens render cleanly
    const store = mountAppDataStore();
    const ctx = store.getState();
    const created = ctx.addOrder({
      order_ref: 'ORD-INV-ONCE',
      full_name: 'Mariam Salleh',
      email: 'mariam@example.com',
      contact_number: '+65 8111 9999',
      programme: 'Uganda - Sheep',
      programme_id: 'prog-ug-sheep',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Mariam Salleh' }],
      total_amount: 165,
      currency: 'SGD',
    });
    expect(created.confirmation_email_sent_at).toBeTruthy();

    const portalOrdersHtml = store.renderScreen(<PortalOrdersPage />);
    expect(portalOrdersHtml).toContain('My Orders');
    const portalCertsHtml = store.renderScreen(<PortalCertificatesPage />);
    expect(portalCertsHtml).toContain('My Certificates');
  });
});
