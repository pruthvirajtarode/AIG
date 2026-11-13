import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppDataProvider, useAppData, sanitizeOrphanRecords, type AppAnimal } from '@/contexts/AppDataContext';
import { LIVE_PROGRAMMES } from '@/data/liveProgrammes';
import {
  AUSTRALIA_SINGAPORE_PORTION_OPTIONS,
  OFFICIAL_WHATSAPP_NUMBER,
  ORDER_PAYMENT_OPTIONS,
  ORDER_SERVICE_OPTIONS,
  animalCodeForOrder,
  calculatePhysicalAnimalsNeeded,
  defaultApproxWeight,
  detectParticipantIdentityConflicts,
  formatDeliveryPortion,
  formatPaymentMethod,
  formatServiceType,
  getProgrammeShareMetadata,
  isAustraliaToSingaporeProgramme,
  isBreedingProgramme,
  isIndonesiaProgramme,
  normaliseEmail,
  normaliseName,
  normalisePhone,
  normaliseWhatsAppPhoneE164,
  participantsMatch,
  selectCertificateTemplate,
  summarizeOrderPortions,
  validateOrderCandidate,
} from '@/lib/orderRules';
import {
  notificationService,
  verifyMetaWebhookSignature,
  WHATSAPP_TEMPLATE_REGISTRY,
  validateWhatsAppTemplate,
} from '@/services/notificationService';
import { paymentProvider } from '@/services/paymentService';
import { validateMediaAuthorization } from '@/services/mediaService';
import { generateCertificatePdf, getCertificateVerificationUrl } from '@/services/certificateService';
import { CertificateDesign } from '@/components/ui/CertificateDesign';
import { CertificateVerifyPage } from '@/App';
import { OrdersPage } from '@/pages/admin/OrdersPage';
import { AnimalsPage } from '@/pages/admin/AnimalsPage';
import { ParticipantsPage } from '@/pages/admin/ParticipantsPage';
import { PaymentsPage } from '@/pages/admin/PaymentsPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
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

    // 3. Phase 4.8: confirmation_email_sent_at is NOT stamped prematurely when simulated; only when live email succeeds
    const store = mountAppDataStore();
    let ctx = store.getState();
    const createdSim = ctx.addOrder({
      order_ref: 'ORD-INV-SIM',
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
    // Synchronous order creation leaves confirmation_email_sent_at null until real provider accepts
    expect(createdSim.confirmation_email_sent_at).toBeNull();
    expect(createdSim.confirmation_email_status).toBe('queued');

    // Also test direct notifyOrderCreatedAndInvoice honest vs simulated behavior:
    notificationService.resetProviders();
    const simInvoiceRes = await notificationService.notifyOrderCreatedAndInvoice({
      recipient: { name: 'Mariam Salleh', email: 'mariam@example.com', phone: '+65 8111 9999' },
      orderRef: 'ORD-INV-SIM-2',
      programme: 'Uganda - Sheep',
      serviceTypeLabel: 'Qurban',
      quantity: 1,
      totalFormatted: 'SGD 165',
      paymentMethodLabel: 'PayNow',
      alreadySentEmail: false,
    });
    expect(simInvoiceRes.emailTrulySubmitted).toBe(false);
    expect(simInvoiceRes.emailDeliveryState).toBe('simulated');

    const portalOrdersHtml = store.renderScreen(<PortalOrdersPage />);
    expect(portalOrdersHtml).toContain('My Orders');
    const portalCertsHtml = store.renderScreen(<PortalCertificatesPage />);
    expect(portalCertsHtml).toContain('My Certificates');
  });

  it('TEST 14: Ambiguous participant identity conflicts flag an Exception without silent merge + fractional 1/7 Cattle share tracking', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    ctx.addOrder({
      order_ref: 'ORD-ID-01',
      full_name: 'Ahmad Rizal',
      email: 'ahmad@example.sg',
      contact_number: '+65 9111 2222',
      programme: 'Australia to Singapore - Cattle (1/7)',
      programme_id: 'prog-au-sg-cattle',
      programme_country: 'Australia to Singapore',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: 'full',
      quantity: 7,
      qurban_entries: Array.from({ length: 7 }, (_, idx) => ({
        qurban_name_holder: `Holder ${idx + 1}`,
        delivery_portion: 'full',
      })),
      total_amount: 2135,
      currency: 'SGD',
    });

    ctx = store.getState();
    const cattleAnimals = ctx.animals.filter(a => a.order_ref === 'ORD-ID-01');
    expect(cattleAnimals).toHaveLength(7);
    expect(cattleAnimals[0].animals_per_share).toBe(7);
    expect(cattleAnimals[0].share_ratio).toBe('1/7');
    expect(calculatePhysicalAnimalsNeeded(7, 7)).toBe(1);
    expect(calculatePhysicalAnimalsNeeded(8, 7)).toBe(2);
    expect(getProgrammeShareMetadata('Australia to Singapore - Cattle (1/7)').label).toContain('1/7 Cattle Share');

    // Different name using same email -> must create separate participant AND raise identity conflict exception
    ctx.addOrder({
      order_ref: 'ORD-ID-02',
      full_name: 'Fatimah Rizal',
      email: 'ahmad@example.sg',
      contact_number: '+65 9333 4444',
      programme: 'Uganda - Goat',
      programme_id: 'prog-ug-goat',
      programme_country: 'Uganda',
      service_type: 'aqiqah',
      payment_method: 'cash',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Baby Yusuf' }],
      total_amount: 145,
      currency: 'SGD',
    });

    ctx = store.getState();
    expect(ctx.participants).toHaveLength(2);
    const conflictEx = ctx.exceptions.find(e => e.category === 'Participant' && e.title.includes('ORD-ID-02'));
    expect(conflictEx).toBeDefined();
    expect(conflictEx?.status).toBe('open');

    const conflictsDirect = detectParticipantIdentityConflicts(
      { full_name: 'Fatimah Rizal', email: 'ahmad@example.sg', contact_number: '+65 9333 4444' },
      ctx.participants.filter(p => p.first_name === 'Ahmad'),
    );
    expect(conflictsDirect.length).toBeGreaterThan(0);

    // Weight timeline updates must be stripped on non-breeding order animals
    const ugGoat = ctx.animals.find(a => a.order_ref === 'ORD-ID-02')!;
    ctx.updateAnimal(ugGoat.id, { current_weight_kg: 22 });
    const afterNonBreedingUpdate = store.getState().animals.find(a => a.id === ugGoat.id)!;
    expect(afterNonBreedingUpdate.weight_history).toEqual([]);
  });

  it('TEST 15: WhatsApp production hardening — E.164 normalization, approved Utility Templates, retry, duplicate suppression, HMAC webhook & Settings diagnostics', async () => {
    notificationService.resetProviders();
    notificationService.resetState();

    // 1. E.164 normalization handles SG 8-digit numbers, spaced numbers, and rejects malformed ones
    const norm1 = normaliseWhatsAppPhoneE164('8545 6783');
    expect(norm1.valid && norm1.e164).toBe('+6585456783');
    const norm2 = normaliseWhatsAppPhoneE164('+65 9123-4567');
    expect(norm2.valid && norm2.e164).toBe('+6591234567');
    expect(normaliseWhatsAppPhoneE164('123').valid).toBe(false);

    // 2. Approved Meta WhatsApp template registry covers all events & validates required variables cleanly
    expect(Object.keys(WHATSAPP_TEMPLATE_REGISTRY).length).toBeGreaterThanOrEqual(11);
    const validTpl = validateWhatsAppTemplate('certificate.ready', {
      participant_name: 'Zainab',
      order_ref: 'ORD-50001',
      certificate_ref: 'CERT-2026-0001',
      programme: 'Uganda - Goat',
    });
    expect(validTpl.valid).toBe(true);
    const invalidTpl = validateWhatsAppTemplate('certificate.ready', { participant_name: 'Zainab' });
    expect(invalidTpl.valid).toBe(false);

    // 3. Transient failure triggers automatic retry, then succeeds; duplicate idempotencyKey suppresses repeat send
    let callCount = 0;
    notificationService.setProviders({
      whatsapp: {
        name: 'flaky-wa',
        isSimulated: false,
        send: async () => {
          callCount += 1;
          if (callCount === 1) return { success: false, error: '503 upstream timeout' };
          return { success: true, channelUsed: 'whatsapp', providerRef: 'wamid.test.retry.ok' };
        },
      },
      email: {
        name: 'live-email',
        isSimulated: false,
        send: async () => ({ success: true, channelUsed: 'email', providerRef: 'email-fallback-1' }),
      },
    });

    const retriedRes = await notificationService.sendWhatsAppWithEmailFallback({
      recipient: { name: 'Hassan', email: 'hassan@example.sg', phone: '+6591234567' },
      subject: 'Order Status',
      body: 'Your Qurban is Complete.',
      eventType: 'qurban.completed',
      idempotencyKey: 'qurban_completed:ORD-RETRY-1',
    });
    expect(retriedRes.success).toBe(true);
    expect(retriedRes.deliveryState).toBe('accepted_by_provider');
    expect(callCount).toBe(2);

    // Duplicate send with same idempotencyKey returns cached success without invoking provider again
    const dupRes = await notificationService.sendWhatsAppWithEmailFallback({
      recipient: { name: 'Hassan', email: 'hassan@example.sg', phone: '+6591234567' },
      subject: 'Order Status',
      body: 'Your Qurban is Complete.',
      eventType: 'qurban.completed',
      idempotencyKey: 'qurban_completed:ORD-RETRY-1',
    });
    expect(dupRes.success).toBe(true);
    expect(dupRes.idempotentReplay).toBe(true);
    expect(callCount).toBe(2);

    // 4. Async webhook failure advances log -> failed AND initiates Email fallback
    const webhookUpdate = await notificationService.applyWebhookStatusUpdate({
      providerRef: 'wamid.test.retry.ok',
      status: 'failed',
      errorMessage: '131026 Undeliverable',
    });
    expect(webhookUpdate.updated).toBe(true);
    expect(webhookUpdate.fallbackTriggered).toBe(true);
    expect(webhookUpdate.fallbackResult?.success).toBe(true);
    expect(webhookUpdate.deliveryState).toBe('fallback_completed');

    // 5. Webhook HMAC-SHA256 verification checks real crypto signature
    const payload = JSON.stringify({ entry: [{ id: 'waba-1' }] });
    const secret = 'test-meta-app-secret';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const sigHeader = 'sha256=' + Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyMetaWebhookSignature(payload, sigHeader, secret)).toBe(true);
    expect(await verifyMetaWebhookSignature(payload, 'sha256=deadbeef', secret)).toBe(false);

    // 6. Reset to default sandbox -> SettingsPage renders honest Setup Required status
    notificationService.resetProviders();
    const store = mountAppDataStore();
    const settingsHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/settings']}>
        <AuthProvider>
          <ToastProvider>
            <AppDataProvider>
              <SettingsPage />
            </AppDataProvider>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(settingsHtml).toContain('Settings');
    expect(notificationService.getDiagnostics().whatsappConnectionStatus).toBe('setup_required');
    void store;
  });

  it('TEST 16: Dual Certificate Templates (Breeding cert-sample-1 vs Standard cert-sample-2 including Indonesia Goat XL), multi-Qurban certs, PDF & /verify/:code', async () => {
    // 1. Template selection rules: Breeding ONLY for Indonesia Breeding Programme, Standard for all others incl. Indonesia Goat XL
    expect(selectCertificateTemplate('Indonesia - Breeding Programme', 'prog-id-breeding', true)).toBe('breeding_programme');
    expect(selectCertificateTemplate('Indonesia - Goat (XL)', 'prog-id-goat-xl', false)).toBe('standard');
    expect(selectCertificateTemplate('Australia to Singapore - Lamb', 'prog-au-sg-lamb', false)).toBe('standard');
    expect(selectCertificateTemplate('Uganda - Cow', 'prog-ug-cow', false)).toBe('standard');

    // 2. Breeding certificate renders framed animal photo inset; Standard renders Gold Rosette Seal & star border
    const store = mountAppDataStore();
    let ctx = store.getState();

    const breedProg = ctx.programmes.find(p => p.id === 'prog-id-breeding')!;
    const breedingOrder = ctx.addOrder({
      order_ref: 'ORD-CERT-BREED',
      full_name: 'Kathija Nachiar',
      email: 'kathija@example.sg',
      contact_number: '+65 9222 1111',
      programme: breedProg.name,
      programme_id: breedProg.id,
      programme_country: breedProg.country,
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Kathija Nachiar' }],
      total_amount: breedProg.price_per_share,
      currency: 'SGD',
    });
    ctx = store.getState();
    ctx.updateOrderStatus(breedingOrder.id, 'certificate_generated');

    // Standard Multi-Qurban Aqiqah order (2 holders on Indonesia - Goat XL -> 2 unique standard certificates!)
    const idGoatProg = ctx.programmes.find(p => p.id === 'prog-id-goat-xl')!;
    const multiAqiqahOrder = ctx.addOrder({
      order_ref: 'ORD-CERT-MULTI',
      full_name: 'Haji Ismail',
      email: 'ismail@example.sg',
      contact_number: '+65 9444 5555',
      programme: idGoatProg.name,
      programme_id: idGoatProg.id,
      programme_country: idGoatProg.country,
      service_type: 'aqiqah',
      payment_method: 'paynow',
      quantity: 2,
      qurban_entries: [
        { qurban_name_holder: 'Nael bin Ismail' },
        { qurban_name_holder: 'Maryam binte Ismail' },
      ],
      total_amount: idGoatProg.price_per_share * 2,
      currency: 'SGD',
    });
    ctx = store.getState();
    ctx.updateOrderStatus(multiAqiqahOrder.id, 'certificate_generated');

    ctx = store.getState();
    const breedingCert = ctx.certificates.find(c => c.order_ref === 'ORD-CERT-BREED')!;
    expect(breedingCert.template_type).toBe('breeding_programme');
    const breedingHtml = renderToStaticMarkup(<CertificateDesign cert={breedingCert} />);
    expect(breedingHtml).toContain('data-template-type="breeding_programme"');
    expect(breedingHtml).toContain('certificate-breeding-photo-inset');
    expect(breedingHtml).toContain('Kathija Nachiar');

    const multiCerts = ctx.certificates.filter(c => c.order_ref === 'ORD-CERT-MULTI');
    expect(multiCerts).toHaveLength(2);
    expect(multiCerts.every(c => c.template_type === 'standard')).toBe(true);
    expect(multiCerts.every(c => c.service_type === 'aqiqah')).toBe(true);
    expect(new Set(multiCerts.map(c => c.certificate_ref)).size).toBe(2);
    expect(multiCerts.map(c => c.qurban_name_holder)).toEqual(expect.arrayContaining(['Nael bin Ismail', 'Maryam binte Ismail']));

    const standardHtml = renderToStaticMarkup(<CertificateDesign cert={multiCerts[0]} />);
    expect(standardHtml).toContain('data-template-type="standard"');
    expect(standardHtml).toContain('AQIQAH');
    expect(standardHtml).toContain('certificate-gold-rosette-seal');
    expect(standardHtml).toContain('certificate-standard-bottom-border');

    // 3. PDF Generation & Verification URL check
    expect(getCertificateVerificationUrl(multiCerts[0].verification_code)).toBe(
      `https://www.aigsuite.com/verify/${multiCerts[0].verification_code}`,
    );
    const pdfBlob = await generateCertificatePdf({
      certificate: {
        id: multiCerts[0].id,
        tenant_id: 'al-ihsan',
        order_id: multiAqiqahOrder.id,
        participant_id: multiAqiqahOrder.participant_id ?? '',
        certificate_ref: multiCerts[0].certificate_ref,
        status: multiCerts[0].status,
        programme_name: idGoatProg.name,
        participant_name: multiCerts[0].participant_name,
        qurban_name_holder: multiCerts[0].qurban_name_holder,
        service_type: 'aqiqah',
        country: idGoatProg.country,
        hijri_year: 1447,
        gregorian_year: 2026,
        serial_number: null,
        qurban_date: idGoatProg.qurban_date,
        animal_ref: multiCerts[0].animal_ref,
        animal_type: idGoatProg.animal_type,
        animal_label: multiCerts[0].animal_label,
        storage_key: null,
        public_url: null,
        verification_code: multiCerts[0].verification_code,
        generated_at: multiCerts[0].generated_at,
        generated_by: null,
        sent_at: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template_type: 'standard',
      },
      order: {
        id: multiAqiqahOrder.id,
        tenant_id: 'al-ihsan',
        order_ref: multiAqiqahOrder.order_ref,
        participant_id: multiAqiqahOrder.participant_id ?? '',
        programme_id: idGoatProg.id,
        status: 'certificate_generated',
        quantity: 2,
        unit_price: idGoatProg.price_per_share,
        total_amount: idGoatProg.price_per_share * 2,
        currency: 'SGD',
        service_type: 'aqiqah',
        qurban_name: null,
        qurban_phone: null,
        qurban_email: null,
        preferred_animal: null,
        delivery_portion: null,
        hijri_year: 1447,
        supplier_id: null,
        legacy_ref: null,
        is_returning_customer: null,
        would_recommend: null,
        feedback: null,
        recipient_name: null,
        recipient_notes: null,
        delivery_address: null,
        special_requests: null,
        internal_notes: null,
        metadata: {},
        confirmed_at: null,
        completed_at: null,
        cancelled_at: null,
        cancel_reason: null,
        created_by: null,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      participant: {
        id: multiAqiqahOrder.participant_id ?? '',
        tenant_id: 'al-ihsan',
        profile_id: null,
        participant_ref: 'PRT-001',
        first_name: 'Haji',
        last_name: 'Ismail',
        email: 'ismail@example.sg',
        phone: '+65 9444 5555',
        country: 'Singapore',
        nationality: null,
        metadata: {},
        ic_number: null,
        notes: null,
        portal_access: true,
        is_active: true,
        created_by: null,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      programme: {
        id: idGoatProg.id,
        tenant_id: 'al-ihsan',
        name: idGoatProg.name,
        slug: idGoatProg.slug,
        description: null,
        country: idGoatProg.country,
        region: null,
        service_type: 'qurban',
        supports_portions: false,
        hijri_year: 1447,
        animal_type: idGoatProg.animal_type,
        animals_per_share: 1,
        shares_available: 0,
        min_quantity: 1,
        max_quantity: null,
        price_per_share: idGoatProg.price_per_share,
        currency: 'SGD',
        distribution_method: 'local_distribution',
        delivery_required: false,
        certificate_required: true,
        evidence_required: false,
        workflow_config: {},
        status_flow: [],
        notification_config: {},
        starts_at: null,
        ends_at: null,
        qurban_date: idGoatProg.qurban_date,
        is_active: true,
        sort_order: 1,
        metadata: {},
        created_by: null,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.size).toBeGreaterThan(500);

    // 4. Public /verify/:code route displays non-sensitive verification info and never leaks participant email/phone/IC
    const verifyHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/verify/${multiCerts[0].verification_code}`]}>
        <AuthProvider>
          <ToastProvider>
            <AppDataProvider>
              <Routes>
                <Route path="/verify/:code" element={<CertificateVerifyPage />} />
              </Routes>
            </AppDataProvider>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(verifyHtml).toContain('Verified Authentic Certificate');
    expect(verifyHtml).toContain(multiCerts[0].verification_code);
    expect(verifyHtml).not.toContain('ismail@example.sg');
    expect(verifyHtml).not.toContain('+65 9444 5555');
  });

  it('TEST 17: Honest payment provider (never auto-paid) & strict media upload authorization', async () => {
    // 1. Payment verification returns pending/requiresManualVerification instead of falsely marking 'paid'
    const init = await paymentProvider.initiate({
      orderId: 'ord-1',
      amount: 165,
      currency: 'SGD',
      method: 'paynow',
      participantEmail: 'test@example.sg',
      participantName: 'Test User',
      description: 'Qurban order ORD-1',
    });
    expect(init.status).toBe('initiated_pending_proof');
    expect(init.isSimulated).toBe(true);
    const verifyRes = await paymentProvider.verify(init.transactionRef!);
    expect(verifyRes.status).toBe('pending');
    expect(verifyRes.requiresManualVerification).toBe(true);
    expect(verifyRes.isSimulated).toBe(true);

    // 2. Media upload authorization rules (participants may only upload payment-proofs for their own orders)
    expect(
      validateMediaAuthorization({
        actorRole: 'participant',
        actorParticipantId: 'p1',
        resourceOwnerParticipantId: 'p1',
        category: 'inspection',
        action: 'upload',
      }).authorized,
    ).toBe(false);
    expect(
      validateMediaAuthorization({
        actorRole: 'super_admin',
        category: 'inspection',
        action: 'upload',
      }).authorized,
    ).toBe(true);
    expect(
      validateMediaAuthorization({
        actorRole: 'participant',
        actorParticipantId: 'p1',
        resourceOwnerParticipantId: 'p2',
        category: 'payment-proofs',
        action: 'upload',
      }).authorized,
    ).toBe(false);
    expect(
      validateMediaAuthorization({
        actorRole: 'participant',
        actorParticipantId: 'p1',
        resourceOwnerParticipantId: 'p1',
        category: 'payment-proofs',
        action: 'upload',
      }).authorized,
    ).toBe(true);
  });

  it('TEST 18: Cancel any order, hide cancelled from Active Orders by default, guard & permanently delete disposable orders cleanly', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    const activeOrder = ctx.addOrder({
      order_ref: 'ORD-KEEP-01',
      full_name: 'Salma binte Yusuf',
      email: 'salma@example.sg',
      contact_number: '+65 9111 0001',
      programme: 'Uganda - Goat',
      programme_id: 'prog-ug-goat',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Salma binte Yusuf' }],
      total_amount: 145,
      currency: 'SGD',
    });

    const disposableOrder = ctx.addOrder({
      order_ref: 'ORD-DEL-02',
      full_name: 'Test Order User',
      email: 'testdel@example.sg',
      contact_number: '+65 9222 0002',
      programme: 'Uganda - Sheep',
      programme_id: 'prog-ug-sheep',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 2,
      qurban_entries: [
        { qurban_name_holder: 'Test Holder 1' },
        { qurban_name_holder: 'Test Holder 2' },
      ],
      total_amount: 330,
      currency: 'SGD',
    });

    // Advance disposable order to confirmed -> direct delete MUST throw until cancelled first
    ctx = store.getState();
    ctx.updateOrderStatus(disposableOrder.id, 'confirmed');
    ctx = store.getState();
    expect(() => ctx.deleteOrder(disposableOrder.id)).toThrow(/Cancel this order first/);

    // Admin cancels disposable order -> hidden from default Live Orders table, toggle pill shows count
    ctx.cancelOrder(disposableOrder.id);
    const htmlAfterCancel = store.renderScreen(<OrdersPage />);
    expect(htmlAfterCancel).toContain('Live Orders');
    expect(htmlAfterCancel).toContain('ORD-KEEP-01');
    expect(htmlAfterCancel).not.toContain('ORD-DEL-02');
    expect(htmlAfterCancel).toContain('Cancelled (1)');
    expect(htmlAfterCancel).toContain('+ Show 1 Cancelled');

    // Permanently delete cancelled order -> cascades linked animals/payments/deliveries/certificates + writes audit log
    ctx = store.getState();
    ctx.deleteOrder(disposableOrder.id);
    const afterDelete = store.getState();
    expect(afterDelete.orders.some(o => o.order_ref === 'ORD-DEL-02')).toBe(false);
    expect(afterDelete.orders.some(o => o.order_ref === 'ORD-KEEP-01')).toBe(true);
    expect(afterDelete.animals.some(a => a.order_ref === 'ORD-DEL-02')).toBe(false);
    expect(afterDelete.payments.some(p => p.order_ref === 'ORD-DEL-02')).toBe(false);
    expect(afterDelete.certificates.some(c => c.order_ref === 'ORD-DEL-02')).toBe(false);
    expect(afterDelete.auditLogs.some(l => l.action === 'order.deleted' && l.entity_id === 'ORD-DEL-02')).toBe(true);
    void activeOrder;
  });

  it('TEST 19: Installment count selector, schedule computation, partial payment recording with nudge reminder & final settlement', async () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    const ord = ctx.addOrder({
      order_ref: 'ORD-INST-19',
      full_name: 'Johnny Tan',
      email: 'johnny@example.sg',
      contact_number: '+65 9111 2233',
      programme: 'Indonesia - Breeding Programme',
      programme_id: 'prog-id-breeding',
      programme_country: 'Indonesia',
      service_type: 'qurban',
      payment_method: 'installment',
      installment_count: 2,
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Johnny Tan' }],
      total_amount: 360,
      currency: 'SGD',
      status: 'pending_payment',
    });

    ctx = store.getState();
    const createdOrder = ctx.orders.find(o => o.id === ord.id)!;
    const createdPay = ctx.payments.find(p => p.order_ref === 'ORD-INST-19')!;
    expect(createdOrder.status).toBe('pending_payment');
    expect(createdOrder.installment_count).toBe(2);
    expect(createdOrder.installments_paid).toBe(0);
    expect(createdOrder.installment_schedule).toHaveLength(2);
    expect(createdOrder.installment_schedule?.[0].amount).toBe(180);
    expect(createdOrder.installment_schedule?.[1].amount).toBe(180);
    expect(createdPay.installment_count).toBe(2);

    // Record 1st installment -> 1 of 2 paid, 1 remaining, payment remains submitted (not fully verified yet)
    ctx.recordInstallmentPayment(ord.id, '2026-11-01T00:00:00.000Z');
    await new Promise(r => setTimeout(r, 20));
    ctx = store.getState();
    const afterFirst = ctx.orders.find(o => o.id === ord.id)!;
    const payAfterFirst = ctx.payments.find(p => p.order_ref === 'ORD-INST-19')!;
    expect(afterFirst.installments_paid).toBe(1);
    expect(afterFirst.status).toBe('pending_payment');
    expect(payAfterFirst.status).toBe('submitted');
    expect(ctx.auditLogs.some(l => l.action === 'payment.installment_recorded' && l.entity_id === 'ORD-INST-19')).toBe(true);
    expect(notificationService.getDeliveryLogs().some(n => n.eventType === 'payment.installment_reminder' && n.orderRef === 'ORD-INST-19')).toBe(true);

    // Record 2nd (final) installment -> 2 of 2 paid, payment & order automatically advance to payment_verified
    ctx.recordInstallmentPayment(ord.id);
    ctx = store.getState();
    const afterFinal = ctx.orders.find(o => o.id === ord.id)!;
    const payAfterFinal = ctx.payments.find(p => p.order_ref === 'ORD-INST-19')!;
    expect(afterFinal.installments_paid).toBe(2);
    expect(afterFinal.status).toBe('payment_verified');
    expect(payAfterFinal.status).toBe('verified');
  });

  it('TEST 20: Bidirectional Order-as-Single-Source-of-Truth sync across Orders, Animals, Deliveries & Certificates', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    // 1. Order -> Animals & Certificates: advancing Order from final_inspection to qurban_complete must advance Animal from inspection_passed to slaughtered
    const ordA = ctx.addOrder({
      order_ref: 'ORD-SYNC-20A',
      full_name: 'Sync User A',
      email: 'synca@example.sg',
      contact_number: '+65 9333 4444',
      programme: 'Australia to Singapore - Sheep',
      programme_id: 'prog-au-sg-sheep',
      programme_country: 'Australia',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: 'full',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Sync User A', delivery_portion: 'full' }],
      total_amount: 390,
      currency: 'SGD',
      status: 'final_inspection',
    });

    ctx = store.getState();
    const animalA = ctx.animals.find(a => a.order_ref === 'ORD-SYNC-20A')!;
    ctx.updateAnimalStatus(animalA.id, 'inspection_passed');
    ctx = store.getState();
    expect(ctx.animals.find(a => a.id === animalA.id)!.status).toBe('inspection_passed');

    // Now update Order to qurban_complete -> Animal MUST advance to slaughtered (not stay stuck on inspection_passed)
    ctx.updateOrderStatus(ordA.id, 'qurban_complete');
    ctx = store.getState();
    expect(ctx.animals.find(a => a.id === animalA.id)!.status).toBe('slaughtered');
    expect(ctx.certificates.some(c => c.order_ref === 'ORD-SYNC-20A')).toBe(true);

    // 2. Animals -> Order -> Deliveries & Certificates: marking an Animal as completed in Animals tab must update Order, Delivery & Certificate
    const ordB = ctx.addOrder({
      order_ref: 'ORD-SYNC-20B',
      full_name: 'Sync User B',
      email: 'syncb@example.sg',
      contact_number: '+65 9555 6666',
      programme: 'Australia to Singapore - Sheep',
      programme_id: 'prog-au-sg-sheep',
      programme_country: 'Australia',
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: 'full',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Sync User B', delivery_portion: 'full' }],
      total_amount: 390,
      currency: 'SGD',
      status: 'final_inspection',
    });

    ctx = store.getState();
    const animalB = ctx.animals.find(a => a.order_ref === 'ORD-SYNC-20B')!;
    ctx.updateAnimalStatus(animalB.id, 'completed');

    ctx = store.getState();
    expect(ctx.orders.find(o => o.id === ordB.id)!.status).toBe('completed');
    expect(ctx.deliveries.find(d => d.order_ref === 'ORD-SYNC-20B')!.status).toBe('delivered');
    expect(ctx.certificates.find(c => c.order_ref === 'ORD-SYNC-20B')!.status).toBe('generated');
  });

  it('TEST 21: Live stats, deletePayment bidirectional signal back to Orders & cancelled filtering across all 5 admin modules', async () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    // 1. Create 2 orders: 1 live order with 2 animals, 1 disposable order with 1 animal
    const liveOrder = ctx.addOrder({
      order_ref: 'ORD-LIVE-21A',
      full_name: 'Live Customer',
      email: 'live@example.sg',
      contact_number: '+65 9111 8888',
      programme: 'Indonesia - Goat (XL)',
      programme_id: 'prog-id-goat-xl',
      programme_country: 'Indonesia',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 2,
      qurban_entries: [{ qurban_name_holder: 'Live Animal 1' }, { qurban_name_holder: 'Live Animal 2' }],
      total_amount: 580,
      currency: 'SGD',
      status: 'payment_verified',
    });

    const deadOrder = ctx.addOrder({
      order_ref: 'ORD-DEAD-21B',
      full_name: 'Dead Customer',
      email: 'dead@example.sg',
      contact_number: '+65 9222 7777',
      programme: 'Uganda - Sheep',
      programme_id: 'prog-ug-sheep',
      programme_country: 'Uganda',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 1,
      qurban_entries: [{ qurban_name_holder: 'Dead Animal 1' }],
      total_amount: 165,
      currency: 'SGD',
      status: 'payment_verified',
    });

    // Cancel dead order
    ctx = store.getState();
    ctx.cancelOrder(deadOrder.id);
    ctx = store.getState();

    // Total orders is 2, but Live Orders is 1!
    expect(ctx.orders).toHaveLength(2);
    expect(ctx.orders.filter(o => o.status !== 'cancelled')).toHaveLength(1);

    // OrdersPage UI checks: renders Live Orders stat & hides cancelled by default
    const ordersHtml = store.renderScreen(<OrdersPage />);
    expect(ordersHtml).toContain('Live Orders');
    expect(ordersHtml).toContain('ORD-LIVE-21A');
    expect(ordersHtml).not.toContain('ORD-DEAD-21B');
    expect(ordersHtml).toContain('+ Show 1 Cancelled');

    // AnimalsPage UI checks: 2 live animals shown, dead order animal hidden by default
    const animalsHtml = store.renderScreen(<AnimalsPage />);
    expect(animalsHtml).toContain('Live Allocations');
    expect(animalsHtml).toContain('ANM-LIVE-21A-01');
    expect(animalsHtml).toContain('ANM-LIVE-21A-02');
    expect(animalsHtml).not.toContain('ANM-DEAD-21B-01');
    expect(animalsHtml).toContain('+ Show 1 Cancelled');

    // PaymentsPage UI checks: live payment shown, dead order payment hidden by default
    const paymentsHtml = store.renderScreen(<PaymentsPage />);
    expect(paymentsHtml).toContain('Live Payments');
    expect(paymentsHtml).toContain('ORD-LIVE-21A');
    expect(paymentsHtml).not.toContain('ORD-DEAD-21B');
    expect(paymentsHtml).toContain('+ Show 1 Cancelled');

    // 2. deletePayment test: verify payment delete removes payment and signals back to order!
    const livePay = ctx.payments.find(p => p.order_ref === 'ORD-LIVE-21A')!;
    expect(livePay).toBeDefined();
    ctx.deletePayment(livePay.id);

    ctx = store.getState();
    // Payment is removed from payments list
    expect(ctx.payments.some(p => p.id === livePay.id)).toBe(false);
    // Order status reverted from payment_verified to pending_payment!
    const updatedLiveOrder = ctx.orders.find(o => o.id === liveOrder.id)!;
    expect(updatedLiveOrder.status).toBe('pending_payment');
    // Audit log recorded for payment deletion
    expect(ctx.auditLogs.some(l => l.action === 'payment.deleted' && l.entity_id === livePay.payment_ref)).toBe(true);
  });

  it('TEST 22: Sanitizes legacy test animal A-2026-001 (TEST 1), displays exactly 3 Live Allocations for 2 active orders, and provides deleteAnimal with audit logging', () => {
    const store = mountAppDataStore();
    let ctx = store.getState();

    // 1. Create Order 1: ORD-10025 with 1 animal (Lamb)
    const o1 = ctx.addOrder({
      order_ref: 'ORD-10025',
      full_name: 'TEST 12NOV26 0710HRS',
      email: 'info@daredevildigital.com',
      contact_number: '88240612',
      programme: 'Australia to Singapore - Lamb',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 1,
      total_amount: 345,
      delivery_portion: 'two_thirds',
      qurban_entries: [{ qurban_name_holder: 'TEST 12NOV26 0710HRS', delivery_portion: 'two_thirds' }],
    });
    ctx.updateOrderStatus(o1.id, 'completed');

    // 2. Create Order 2: ORD-10001 with 2 animals (Goat XL)
    const o2 = ctx.addOrder({
      order_ref: 'ORD-10001',
      full_name: 'TEST 04NOV26 1109HRS',
      email: 'info@daredevildigital.com',
      contact_number: '88240612',
      programme: 'Indonesia - Goat (XL)',
      service_type: 'qurban',
      payment_method: 'paynow',
      quantity: 2,
      total_amount: 580,
      qurban_entries: [
        { qurban_name_holder: 'Qurban 1' },
        { qurban_name_holder: 'Qurban 2' },
      ],
    });
    ctx.updateOrderStatus(o2.id, 'completed');

    // 3. Inject legacy test animal A-2026-001 with location TEST 1 and tag TG-0001 directly into localStorage
    const legacyMockAnimal: AppAnimal = {
      id: 'legacy-test-mock-001',
      animal_ref: 'A-2026-001',
      animal_type: 'sheep',
      breed: 'Boer',
      gender: 'male',
      status: 'allocated',
      current_weight_kg: 40,
      min_weight_kg: 24,
      location: 'TEST 1',
      supplier: 'Test Supplier',
      tag_number: 'TG-0001',
      created_at: new Date().toISOString(),
    };

    const raw = JSON.parse(localStorage.getItem('aigms-data-v1') || '{}');
    raw.animals = [legacyMockAnimal, ...(raw.animals || [])];
    localStorage.setItem('aigms-data-v1', JSON.stringify(raw));

    // Remounting triggers loadData() which runs sanitizeOrphanRecords
    ctx = store.remountFromStorage();
    expect(ctx.animals.some(a => a.animal_ref === 'A-2026-001')).toBe(false);
    expect(ctx.animals.some(a => a.location === 'TEST 1')).toBe(false);
    expect(ctx.animals.some(a => a.tag_number === 'TG-0001')).toBe(false);

    // 4. Register a disposable farm stock animal to verify deleteAnimal
    const disposableAnimal: AppAnimal = {
      id: 'disposable-stock-002',
      animal_ref: 'A-2026-999',
      animal_type: 'goat',
      breed: 'Boer',
      gender: 'female',
      status: 'available',
      current_weight_kg: 32,
      min_weight_kg: 25,
      location: 'Malaysia Farm',
      supplier: 'Kedah Livestock',
      tag_number: 'TG-9999',
      created_at: new Date().toISOString(),
    };
    ctx.addAnimal(disposableAnimal);
    ctx = store.getState();
    expect(ctx.animals.some(a => a.id === disposableAnimal.id)).toBe(true);

    // 5. Verify AnimalsPage rendering:
    const animalsHtml = store.renderScreen(<AnimalsPage />);
    expect(animalsHtml).not.toContain('A-2026-001');
    expect(animalsHtml).not.toContain('📍 TEST 1');
    expect(animalsHtml).not.toContain('TG-0001');
    expect(animalsHtml).toContain('ANM-10025-01');
    expect(animalsHtml).toContain('ANM-10001-01');
    expect(animalsHtml).toContain('ANM-10001-02');

    // 6. Test deleteAnimal on disposable animal
    ctx.deleteAnimal(disposableAnimal.id);
    ctx = store.getState();
    expect(ctx.animals.some(a => a.id === disposableAnimal.id)).toBe(false);
    expect(ctx.auditLogs.some(l => l.action === 'animal.deleted' && l.entity_id === disposableAnimal.animal_ref)).toBe(true);

    // 7. Verify live animals count matches exactly the 3 animals belonging to the 2 active orders
    const activeAnimals = ctx.animals.filter(a => a.order_ref === 'ORD-10025' || a.order_ref === 'ORD-10001');
    expect(activeAnimals).toHaveLength(3);
  });
});
