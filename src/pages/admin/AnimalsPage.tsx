import React, { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Plus, X, Weight, CheckCircle2, ClipboardCheck, RefreshCw, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { AnimalStatus, AnimalType } from '@/lib/database.types';
import {
  calculatePhysicalAnimalsNeeded,
  defaultApproxWeight,
  formatDeliveryPortion,
  formatServiceType,
  getProgrammeShareMetadata,
  isBreedingProgramme,
} from '@/lib/orderRules';
import { useToast } from '@/contexts/ToastContext';
import { ANIMAL_IMAGES } from '@/lib/animalImages';
import { useAppData, nextRef, uid, type AppAnimal as Animal } from '@/contexts/AppDataContext';

// ── Real photorealistic animal images (shared map in lib/animalImages) ──

const ANIMAL_STATUS_BADGE: Record<AnimalStatus, string> = {
  available:          'badge-green',
  reserved:           'badge-blue',
  allocated:          'badge-purple',
  growing:            'badge-teal',
  inspection_pending: 'badge-yellow',
  inspection_passed:  'badge-green',
  qurban_ready:       'badge-emerald',
  slaughtered:        'badge-gray',
  processed:          'badge-gray',
  completed:          'badge-gray',
  rejected:           'badge-red',
};

const ANIMAL_STATUS_LABEL: Record<AnimalStatus, string> = {
  available:          'Available',
  reserved:           'Reserved',
  allocated:          'Allocated',
  growing:            'Growing',
  inspection_pending: 'Inspection Pending',
  inspection_passed:  'Inspection Passed',
  qurban_ready:       'Qurban Ready',
  slaughtered:        'Slaughtered',
  processed:          'Processed',
  completed:          'Completed',
  rejected:           'Rejected',
};


// ── Register Animal Modal ────────────────────────────────────
const ANIMAL_TYPES: AnimalType[] = ['cow', 'goat', 'sheep', 'lamb', 'camel', 'buffalo'];
const GENDERS = ['male', 'female'];

function RegisterAnimalModal({ onClose, onRegister, nextAnimalRef }: {
  onClose: () => void;
  onRegister: (animal: Animal) => void;
  nextAnimalRef: string;
}) {
  const { toast } = useToast();
  const { suppliers, programmes } = useAppData();
  const activeProgrammes = programmes.filter(p => p.is_active);

  const [programmeName, setProgrammeName] = useState('');
  const [animalType, setAnimalType] = useState<AnimalType>('cow');
  const [breed,      setBreed]      = useState('');
  const [gender,     setGender]     = useState('male');
  const [weight,     setWeight]     = useState('');
  const [minWeight,  setMinWeight]  = useState('');
  const [location,   setLocation]   = useState('');
  const [supplier,   setSupplier]   = useState('');
  const [tagNumber,  setTagNumber]  = useState('');
  const [status,     setStatus]     = useState<AnimalStatus>('available');

  const handleProgramme = (name: string) => {
    setProgrammeName(name);
    const prog = activeProgrammes.find(p => p.name === name);
    if (prog) {
      setAnimalType(prog.animal_type);
      if (!location.trim()) setLocation(prog.country);
    }
  };

  const handleSubmit = () => {
    if (!breed.trim() || !location.trim() || !supplier.trim() || !tagNumber.trim()) {
      toast('error', 'Missing fields', 'Breed, location, supplier and tag number are required');
      return;
    }
    if (!weight || Number(weight) <= 0) {
      toast('error', 'Invalid weight', 'Please enter a valid current weight');
      return;
    }
    if (!minWeight || Number(minWeight) <= 0) {
      toast('error', 'Invalid min weight', 'Please enter a valid minimum weight threshold');
      return;
    }
    const newAnimal: Animal = {
      id: uid(),
      animal_ref: nextAnimalRef,
      animal_type: animalType,
      breed: breed.trim(),
      gender,
      status,
      current_weight_kg: Number(weight),
      min_weight_kg: Number(minWeight),
      location: location.trim(),
      supplier: supplier.trim(),
      tag_number: tagNumber.trim(),
      created_at: new Date().toISOString(),
      ...(programmeName ? { programme: programmeName } : {}),
    };
    onRegister(newAnimal);
    toast('success', 'Animal registered! 🐄', `${newAnimal.animal_ref} — ${breed} added to the system`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="heading-md">Register Animal</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Ref will be: <strong style={{ color: 'var(--aig-green-300)', fontFamily: 'monospace' }}>{nextAnimalRef}</strong></div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Programme</label>
              <select id="animal-programme" className="form-input form-select" value={programmeName} onChange={e => handleProgramme(e.target.value)}>
                <option value="">General stock (no programme)</option>
                {activeProgrammes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Animal Type *</label>
              <select className="form-input form-select" value={animalType} onChange={e => setAnimalType(e.target.value as AnimalType)}>
                {ANIMAL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Breed *</label>
              <input className="form-input" placeholder="e.g. Brahman, Boer, Merino" value={breed} onChange={e => setBreed(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Gender *</label>
              <select className="form-input form-select" value={gender} onChange={e => setGender(e.target.value)}>
                {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tag Number *</label>
              <input className="form-input" placeholder="e.g. TG-001" value={tagNumber} onChange={e => setTagNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Current Weight (kg) *</label>
              <input className="form-input" type="number" min="0" step="0.1" placeholder="e.g. 350" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Min Weight Threshold (kg) *</label>
              <input className="form-input" type="number" min="0" step="0.1" placeholder="e.g. 350" value={minWeight} onChange={e => setMinWeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Location *</label>
              <input className="form-input" placeholder="e.g. Farm Maju, Kelantan" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier *</label>
              <input className="form-input" placeholder="e.g. Ternakan Maju Sdn Bhd" list="animal-supplier-list" value={supplier} onChange={e => setSupplier(e.target.value)} />
              <datalist id="animal-supplier-list">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Initial Status</label>
              <select className="form-input form-select" value={status} onChange={e => setStatus(e.target.value as AnimalStatus)}>
                {(Object.keys(ANIMAL_STATUS_LABEL) as AnimalStatus[]).map(s => (
                  <option key={s} value={s}>{ANIMAL_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            <Plus size={14} /> Register Animal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Animal Details Modal ─────────────────────────────────
function EditAnimalModal({ animal, onClose, onSave }: {
  animal: Animal;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Animal>) => void;
}) {
  const { toast } = useToast();
  const { suppliers, programmes } = useAppData();
  const activeProgrammes = programmes.filter(p => p.is_active || p.name === animal.programme);
  const clean = (v: string) => (v === 'To be assigned' || v === 'Pending' ? '' : v);
  const isOrderAnimal = Boolean(animal.order_ref || animal.animal_code);

  const [programmeName, setProgrammeName] = useState(animal.programme ?? '');
  const [animalType, setAnimalType] = useState<AnimalType>(animal.animal_type);
  const [breed, setBreed] = useState(clean(animal.breed));
  const [gender, setGender] = useState(animal.gender || 'male');
  const [tagNumber, setTagNumber] = useState(clean(animal.tag_number));
  const [minWeight, setMinWeight] = useState(String(animal.min_weight_kg || ''));
  const [approxWeight, setApproxWeight] = useState(
    animal.approx_weight ?? defaultApproxWeight(animal.programme, animal.animal_type),
  );
  const [location, setLocation] = useState(animal.location);
  const [supplier, setSupplier] = useState(clean(animal.supplier));
  const [qurbanHolder, setQurbanHolder] = useState(animal.qurban_name_holder ?? '');

  const handleSave = () => {
    if (!location.trim()) {
      toast('error', 'Missing fields', 'Location is required');
      return;
    }
    if (!isOrderAnimal && (!breed.trim() || !tagNumber.trim() || !supplier.trim())) {
      toast('error', 'Missing fields', 'Breed, tag number, location and supplier are required');
      return;
    }
    if (isOrderAnimal && !qurbanHolder.trim()) {
      toast('error', 'Missing fields', 'Qurban Name Holder is required for order animals');
      return;
    }
    const matchedProg = programmes.find(p => p.name === programmeName);
    onSave(animal.id, {
      programme: programmeName || undefined,
      programme_id: matchedProg?.id ?? animal.programme_id,
      animal_type: animalType,
      breed: breed.trim() || 'To be assigned',
      gender,
      tag_number: tagNumber.trim() || 'Pending',
      min_weight_kg: Number(minWeight) || 0,
      approx_weight: approxWeight.trim() || defaultApproxWeight(programmeName, animalType),
      location: location.trim(),
      supplier: supplier.trim() || 'To be assigned',
      ...(isOrderAnimal ? { qurban_name_holder: qurbanHolder.trim() } : {}),
    });
    toast('success', 'Animal updated', `${animal.animal_code || animal.animal_ref} details saved`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">Edit {animal.animal_code || animal.animal_ref}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Programme</label>
              <select
                className="form-input form-select"
                value={programmeName}
                onChange={e => {
                  const name = e.target.value;
                  setProgrammeName(name);
                  const p = activeProgrammes.find(x => x.name === name);
                  if (p) setAnimalType(p.animal_type);
                }}
              >
                <option value="">General stock (no programme)</option>
                {activeProgrammes.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            {isOrderAnimal && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Qurban Name Holder *</label>
                <input className="form-input" value={qurbanHolder} onChange={e => setQurbanHolder(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Animal Type *</label>
              <select className="form-input form-select" value={animalType} onChange={e => setAnimalType(e.target.value as AnimalType)}>
                {ANIMAL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Breed {isOrderAnimal ? '' : '*'}</label>
              <input className="form-input" placeholder="To be assigned" value={breed} onChange={e => setBreed(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-input form-select" value={gender} onChange={e => setGender(e.target.value)}>
                {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tag Number {isOrderAnimal ? '' : '*'}</label>
              <input className="form-input" placeholder="Pending" value={tagNumber} onChange={e => setTagNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Approx. Weight Label</label>
              <input className="form-input" placeholder="e.g. Approx. 25–30 kg" value={approxWeight} onChange={e => setApproxWeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Min Weight Threshold (kg)</label>
              <input className="form-input" type="number" min="0" step="0.1" value={minWeight} onChange={e => setMinWeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Location *</label>
              <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Supplier {isOrderAnimal ? '' : '*'}</label>
              <input className="form-input" placeholder="To be assigned" list="edit-animal-supplier-list" value={supplier} onChange={e => setSupplier(e.target.value)} />
              <datalist id="edit-animal-supplier-list">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Log Weight Modal ──────────────────────────────────────────
function LogWeightModal({ animal, onClose, onUpdate }: {
  animal: Animal;
  onClose: () => void;
  onUpdate: (id: string, weight: number, notes?: string) => void;
}) {
  const [weight, setWeight] = useState(String(animal.current_weight_kg || ''));
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="heading-md">Log Weight Update</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Animal: <strong style={{ color: 'var(--text-primary)' }}>{animal.animal_code || animal.animal_ref}</strong> — {animal.breed}
          </div>
          <div className="form-group">
            <label className="form-label">Current Weight (kg) *</label>
            <input
              className="form-input" type="number" min="0" step="0.1"
              value={weight} onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 28.5"
              autoFocus
            />
          </div>
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">Update Note (optional)</label>
            <input
              className="form-input"
              placeholder="e.g. Monthly farm weigh-in — healthy growth"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Minimum required: <strong>{animal.min_weight_kg} kg</strong>
            {Number(weight) >= animal.min_weight_kg
              ? <span style={{ color: 'var(--success)', marginLeft: 8 }}>✓ Meets minimum</span>
              : <span style={{ color: 'var(--danger)', marginLeft: 8 }}>⚠ Below minimum</span>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const w = Number(weight);
            if (!w || w <= 0) { toast('error', 'Invalid weight', 'Enter a valid weight'); return; }
            onUpdate(animal.id, w, notes.trim() || undefined);
            toast('success', 'Weight logged!', `${animal.animal_code || animal.animal_ref}: ${w} kg recorded`);
            onClose();
          }}>
            <Weight size={14} /> Save Weight
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Record Inspection Modal ───────────────────────────────────
function InspectionModal({ animal, onClose, onUpdate }: {
  animal: Animal;
  onClose: () => void;
  onUpdate: (id: string, status: AnimalStatus) => void;
}) {
  const [result, setResult] = useState<'pass' | 'fail'>('pass');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="heading-md">Record Inspection</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Animal: <strong style={{ color: 'var(--text-primary)' }}>{animal.animal_ref}</strong> — {animal.breed}
          </div>
          <div className="form-group">
            <label className="form-label">Inspection Result</label>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem' }}>
              {(['pass', 'fail'] as const).map(r => (
                <button key={r} onClick={() => setResult(r)} style={{
                  flex: 1, padding: '0.625rem', borderRadius: 8, cursor: 'pointer',
                  border: result === r
                    ? `1px solid ${r === 'pass' ? 'var(--success)' : 'var(--danger)'}`
                    : '1px solid var(--border-subtle)',
                  background: result === r
                    ? r === 'pass' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
                    : 'var(--surface-800)',
                  color: result === r
                    ? r === 'pass' ? 'var(--success)' : 'var(--danger)'
                    : 'var(--text-muted)',
                  fontWeight: 600, fontSize: '0.875rem',
                }}>
                  {r === 'pass' ? '✓ Pass' : '✗ Fail'}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">Inspection Notes</label>
            <textarea className="form-input" rows={3} placeholder="Inspector observations..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const newStatus: AnimalStatus = result === 'pass' ? 'inspection_passed' : 'rejected';
            onUpdate(animal.id, newStatus);
            toast(
              result === 'pass' ? 'success' : 'warning',
              result === 'pass' ? 'Inspection Passed ✓' : 'Inspection Not Passed',
              `${animal.animal_ref} — ${animal.breed} marked as ${newStatus.replace(/_/g, ' ')}`
            );
            onClose();
          }}>
            <ClipboardCheck size={14} /> Submit Inspection
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Update Status Modal ───────────────────────────────────────
function UpdateAnimalStatusModal({ animal, onClose, onUpdate }: {
  animal: Animal;
  onClose: () => void;
  onUpdate: (id: string, status: AnimalStatus) => void;
}) {
  const ALL_STATUSES: AnimalStatus[] = [
    'available', 'reserved', 'allocated', 'growing',
    'inspection_pending', 'inspection_passed', 'qurban_ready',
    'slaughtered', 'processed', 'completed', 'rejected',
  ];
  const [selected, setSelected] = useState<AnimalStatus>(animal.status);
  const { toast } = useToast();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="heading-md">Update Animal Status</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Animal: <strong style={{ color: 'var(--text-primary)' }}>{animal.animal_ref}</strong>
          </div>
          <div className="status-picker-grid">
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => setSelected(s)} style={{
                padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                border: selected === s ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                background: selected === s ? 'rgba(47,168,118,0.12)' : 'var(--surface-800)',
                color: selected === s ? 'var(--aig-green-200)' : 'var(--text-secondary)',
                fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                {selected === s && <CheckCircle2 size={12} />}
                {ANIMAL_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            onUpdate(animal.id, selected);
            toast('success', 'Status updated!', `${animal.animal_ref} → ${ANIMAL_STATUS_LABEL[selected]}`);
            onClose();
          }}>
            <RefreshCw size={14} /> Apply Status
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Animal Detail Modal ───────────────────────────────────────
function AnimalDetailModal({ animal, onClose, onWeightLog, onInspection, onStatusUpdate, onEdit, onDelete }: {
  animal: Animal;
  onClose: () => void;
  onWeightLog: (a: Animal) => void;
  onInspection: (a: Animal) => void;
  onStatusUpdate: (a: Animal) => void;
  onEdit: (a: Animal) => void;
  onDelete?: (a: Animal) => void;
}) {
  const { programmes } = useAppData();
  const matchedProg = programmes.find(
    p => (animal.programme_id && p.id === animal.programme_id) || p.name === animal.programme,
  );
  const supportsWeightTimeline = !animal.programme || isBreedingProgramme(animal.programme, matchedProg?.supports_weight_timeline);
  const approxLabel = animal.approx_weight || matchedProg?.approx_weight_label || defaultApproxWeight(animal.programme, animal.animal_type);
  const weightPct = animal.min_weight_kg > 0 ? Math.min(100, Math.round((animal.current_weight_kg / animal.min_weight_kg) * 100)) : 100;
  const belowMin = animal.current_weight_kg < animal.min_weight_kg;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12, overflow: 'hidden',
              border: '2px solid rgba(212,168,50,0.3)', flexShrink: 0,
              background: '#111',
            }}>
              <img
                src={ANIMAL_IMAGES[animal.animal_type]}
                alt={animal.animal_type}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <div className="heading-md" style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>
                {animal.animal_code || animal.animal_ref}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {animal.breed} · {animal.animal_type}
                {animal.order_ref ? ` · Order ${animal.order_ref}` : ''}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="settings-grid-2">
            <div className="detail-list">
              {[
                ['Animal Code', animal.animal_code || animal.animal_ref],
                ['Order Reference', animal.order_ref || '—'],
                ['Qurban Name Holder', animal.qurban_name_holder || '—'],
                ['Programme', animal.programme || '—'],
                ['Service Type', formatServiceType(animal.service_type)],
                ...(animal.delivery_portion ? [['Portion to be Delivered', formatDeliveryPortion(animal.delivery_portion)]] : []),
                ['Approx. Weight', approxLabel],
                ['Location', animal.location],
                ['Tag Number', animal.tag_number],
                ['Breed', animal.breed],
                ['Gender', animal.gender || '—'],
                ['Supplier', animal.supplier],
                ['Registered', formatDate(animal.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="detail-row">
                  <div className="detail-key">{k}</div>
                  <div className="detail-val">{v}</div>
                </div>
              ))}
            </div>
            <div>
              {supportsWeightTimeline ? (
                <>
                  {/* Weight Progress (Indonesia Breeding Programme / General Farm Stock) */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Weight Progress</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: belowMin ? 'var(--danger)' : 'var(--success)' }}>
                        {animal.current_weight_kg}kg / {animal.min_weight_kg}kg min
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${weightPct}%`,
                        background: belowMin
                          ? 'linear-gradient(90deg, var(--danger), #f97316)'
                          : 'linear-gradient(90deg, var(--aig-green-600), var(--aig-green-400))',
                      }} />
                    </div>
                    {belowMin && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.375rem' }}>
                        ⚠ Below minimum weight threshold
                      </div>
                    )}
                  </div>

                  {/* Weight Update Timeline */}
                  <div style={{ padding: '0.875rem', background: 'var(--surface-700)', borderRadius: 8, marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--aig-green-300)', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Weight Update Timeline
                    </div>
                    {animal.weight_history && animal.weight_history.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 140, overflowY: 'auto' }}>
                        {animal.weight_history.map((entry, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', paddingBottom: '0.3rem', borderBottom: idx < animal.weight_history!.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>{entry.weight_kg} kg</strong>
                              {entry.notes && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {entry.notes}</span>}
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{formatDate(entry.recorded_at)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        No weight updates logged yet. Click &ldquo;Log Weight Update&rdquo; below to record monthly breeding weight.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ padding: '0.875rem', background: 'var(--surface-700)', borderRadius: 8, marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>Approx. Animal Weight</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--aig-green-300)' }}>{approxLabel}</div>
                </div>
              )}

              {/* Status */}
              <div style={{ padding: '0.875rem', background: 'var(--surface-700)', borderRadius: 8, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Status</div>
                <span className={`badge ${ANIMAL_STATUS_BADGE[animal.status]}`}>{ANIMAL_STATUS_LABEL[animal.status]}</span>
              </div>

              {/* Real animal photo */}
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)', height: 160, background: '#0e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={ANIMAL_IMAGES[animal.animal_type]}
                  alt={`${animal.animal_type} photo`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => onEdit(animal)} style={{ gap: '0.5rem' }}>
            Edit Details
          </button>
          {supportsWeightTimeline && (
            <button className="btn btn-secondary" onClick={() => onWeightLog(animal)} style={{ gap: '0.5rem' }}>
              <Weight size={14} /> Log Weight Update
            </button>
          )}
          <button className="btn btn-outline-green" onClick={() => onInspection(animal)} style={{ gap: '0.5rem' }}>
            <ClipboardCheck size={14} /> Record Inspection
          </button>
          <button className="btn btn-primary" onClick={() => onStatusUpdate(animal)} style={{ gap: '0.5rem' }}>
            <RefreshCw size={14} /> Update Status
          </button>
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: 'var(--danger)', marginLeft: 'auto', gap: '0.4rem' }}
              onClick={() => {
                const label = animal.animal_code || animal.animal_ref;
                if (window.confirm(`Permanently delete animal ${label}? This cannot be undone.`)) {
                  onDelete(animal);
                }
              }}
              title="Delete animal record"
            >
              <Trash2 size={14} /> Delete Animal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function AnimalsPage() {
  usePageTitle('Animals');
  const { toast } = useToast();
  const { animals, programmes, orders, addAnimal, updateAnimal: ctxUpdateAnimal, deleteAnimal } = useAppData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isAnimalCancelled = useCallback((a: Animal) => {
    if (a.order_ref) {
      const linkedOrder = orders.find(o => o.order_ref === a.order_ref);
      if (linkedOrder) {
        return linkedOrder.status === 'cancelled';
      }
      return true;
    }
    // Animals marked allocated with no order are stale/unlinked
    if (a.status === 'allocated' && !a.order_ref) {
      return true;
    }
    return false;
  }, [orders]);

  const cancelledCount = animals.filter(isAnimalCancelled).length;
  const liveAnimals = animals.filter(a => !isAnimalCancelled(a));
  const [weightAnimal, setWeightAnimal] = useState<Animal | null>(null);
  const [inspectionAnimal, setInspectionAnimal] = useState<Animal | null>(null);
  const [statusAnimal, setStatusAnimal] = useState<Animal | null>(null);
  const [editAnimal, setEditAnimal] = useState<Animal | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  const selected = selectedId ? animals.find(a => a.id === selectedId) ?? null : null;
  const nextAnimalRef = nextRef('A', animals.map(a => a.animal_ref), 3);

  const handleDeleteAnimal = useCallback((animal: Animal) => {
    deleteAnimal(animal.id);
    setSelectedId(null);
    toast('success', 'Animal deleted', `Animal ${animal.animal_code || animal.animal_ref} removed from system.`);
  }, [deleteAnimal, toast]);

  const registerAnimal = useCallback((animal: Animal) => {
    addAnimal(animal);
  }, [addAnimal]);

  const updateAnimal = useCallback((id: string, patch: Partial<Animal>) => {
    ctxUpdateAnimal(id, patch);
  }, [ctxUpdateAnimal]);


  const handleWeightUpdate = useCallback((id: string, weight: number, notes?: string) => {
    const existing = animals.find(a => a.id === id);
    const nextHistory = [
      ...(existing?.weight_history ?? []),
      { weight_kg: weight, recorded_at: new Date().toISOString(), ...(notes ? { notes } : {}) },
    ];
    updateAnimal(id, { current_weight_kg: weight, weight_history: nextHistory });
  }, [animals, updateAnimal]);

  const handleStatusUpdate = useCallback((id: string, status: AnimalStatus) => {
    updateAnimal(id, { status });
  }, [updateAnimal]);

  const openWeight = (a: Animal) => { setSelectedId(null); setWeightAnimal(a); };
  const openInspection = (a: Animal) => { setSelectedId(null); setInspectionAnimal(a); };
  const openStatus = (a: Animal) => { setSelectedId(null); setStatusAnimal(a); };
  const openEdit = (a: Animal) => { setSelectedId(null); setEditAnimal(a); };

  const filtered = animals.filter(a => {
    const isCancelled = isAnimalCancelled(a);
    if (!showCancelled && isCancelled && statusFilter !== 'reserved') return false;
    const q = search.toLowerCase();
    const matchSearch =
      a.animal_ref.toLowerCase().includes(q) ||
      (a.animal_code ?? '').toLowerCase().includes(q) ||
      a.breed.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q) ||
      (a.programme ?? '').toLowerCase().includes(q) ||
      (a.service_type ?? '').toLowerCase().includes(q) ||
      (a.order_ref ?? '').toLowerCase().includes(q) ||
      (a.qurban_name_holder ?? '').toLowerCase().includes(q);
    const matchType = !typeFilter || a.animal_type === typeFilter;
    const matchProgramme = !programmeFilter || (programmeFilter === '__none' ? !a.programme : a.programme === programmeFilter);
    const matchService = !serviceFilter || a.service_type === serviceFilter;
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchType && matchProgramme && matchService && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {/* Modals */}
      {showRegister && (
        <RegisterAnimalModal
          onClose={() => setShowRegister(false)}
          onRegister={registerAnimal}
          nextAnimalRef={nextAnimalRef}
        />
      )}
      {selected && (
        <AnimalDetailModal
          animal={selected}
          onClose={() => setSelectedId(null)}
          onWeightLog={openWeight}
          onInspection={openInspection}
          onStatusUpdate={openStatus}
          onEdit={openEdit}
          onDelete={handleDeleteAnimal}
        />
      )}
      {editAnimal && (
        <EditAnimalModal
          animal={editAnimal}
          onClose={() => setEditAnimal(null)}
          onSave={updateAnimal}
        />
      )}
      {weightAnimal && (
        <LogWeightModal
          animal={weightAnimal}
          onClose={() => setWeightAnimal(null)}
          onUpdate={handleWeightUpdate}
        />
      )}
      {inspectionAnimal && (
        <InspectionModal
          animal={inspectionAnimal}
          onClose={() => setInspectionAnimal(null)}
          onUpdate={handleStatusUpdate}
        />
      )}
      {statusAnimal && (
        <UpdateAnimalStatusModal
          animal={statusAnimal}
          onClose={() => setStatusAnimal(null)}
          onUpdate={handleStatusUpdate}
        />
      )}

      {/* Header */}
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Animals</h1>
          <p className="page-subtitle">Track livestock status, weights, and inspections</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
          <Plus size={16} /> Register Animal
        </button>
      </div>

      {/* Stats */}
      {(() => {
        const cattleShares = liveAnimals.filter(a => (a.animals_per_share ?? getProgrammeShareMetadata(a.programme).animals_per_share) === 7).length;
        const physicalCattleEquiv = calculatePhysicalAnimalsNeeded(cattleShares, 7);
        return (
          <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
            {[
              {
                label: 'Live Allocations',
                value: String(liveAnimals.length),
                sub: cancelledCount > 0 ? `+ ${cancelledCount} cancelled` : 'All animals live',
                color: 'var(--aig-green-400)',
              },
              { label: '1/7 Cattle Shares', value: cattleShares > 0 ? `${cattleShares} (${physicalCattleEquiv} cow${physicalCattleEquiv === 1 ? '' : 's'})` : '0', color: 'var(--gold-400)' },
              { label: 'Available', value: String(liveAnimals.filter(a => a.status === 'available').length), color: 'var(--success)' },
              { label: 'Allocated', value: String(liveAnimals.filter(a => a.status === 'allocated').length), color: 'var(--purple, #a855f7)' },
              { label: 'Completed', value: String(liveAnimals.filter(a => a.status === 'completed').length), color: 'var(--aig-green-300)' },
              { label: 'Exceptions', value: String(liveAnimals.filter(a => ['rejected','inspection_pending'].includes(a.status)).length), color: 'var(--danger)' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
                <div className="stat-value" style={{ fontSize: '1.25rem', color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
                {s.sub && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {s.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input
            id="animals-search" type="search" className="form-input"
            placeholder="Search by animal code, order ref, holder, programme..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <select className="form-input form-select" style={{ width: 'auto', height: 38, fontSize: '0.875rem' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {(['cow', 'goat', 'sheep', 'lamb', 'camel', 'buffalo'] as AnimalType[]).map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select id="animals-programme-filter" className="form-input form-select" style={{ width: 'auto', height: 38, fontSize: '0.875rem' }} value={programmeFilter} onChange={e => setProgrammeFilter(e.target.value)}>
          <option value="">All Programmes</option>
          {programmes.filter(p => p.is_active).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          <option value="__none">General stock (no programme)</option>
        </select>
        <select id="animals-service-filter" className="form-input form-select" style={{ width: 'auto', height: 38, fontSize: '0.875rem' }} value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
          <option value="">All Services</option>
          <option value="qurban">Qurban</option>
          <option value="aqiqah">Aqiqah</option>
        </select>
        <select className="form-input form-select" style={{ width: 'auto', height: 38, fontSize: '0.875rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {(Object.keys(ANIMAL_STATUS_LABEL) as AnimalStatus[]).map(s => (
            <option key={s} value={s}>{ANIMAL_STATUS_LABEL[s]}</option>
          ))}
        </select>
        {cancelledCount > 0 && (
          <button
            type="button"
            className={`btn btn-sm ${showCancelled ? 'btn-outline-green' : 'btn-ghost'}`}
            onClick={() => setShowCancelled(s => !s)}
            data-testid="toggle-show-cancelled-animals-btn"
            title="Toggle whether cancelled order animals appear"
          >
            {showCancelled ? 'Hiding Cancelled' : `+ Show ${cancelledCount} Cancelled`}
          </button>
        )}
      </div>

      {/* Animal Grid — real photorealistic images */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
        {filtered.map(a => {
          const matchedProg = programmes.find(
            p => (a.programme_id && p.id === a.programme_id) || p.name === a.programme,
          );
          const supportsWeightTimeline = !a.programme || isBreedingProgramme(a.programme, matchedProg?.supports_weight_timeline);
          const shareMeta = getProgrammeShareMetadata(a.programme, a.animals_per_share ?? matchedProg?.animals_per_share);
          const approxLabel = a.approx_weight || matchedProg?.approx_weight_label || defaultApproxWeight(a.programme, a.animal_type);
          const weightPct = a.min_weight_kg > 0 ? Math.min(100, Math.round((a.current_weight_kg / a.min_weight_kg) * 100)) : 100;
          const belowMin = a.current_weight_kg < a.min_weight_kg;
          const displayCode = a.animal_code || a.animal_ref;
          return (
            <div
              key={a.id}
              className="card card-hover"
              style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}
              onClick={() => setSelectedId(a.id)}
            >
              {/* Real animal image at top */}
              <div style={{ height: 180, background: '#0e1a14', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={ANIMAL_IMAGES[a.animal_type]}
                  alt={a.animal_type}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  onError={e => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = 'none';
                    const parent = el.parentElement;
                    if (parent) parent.style.display = 'flex', parent.style.alignItems = 'center', parent.style.justifyContent = 'center';
                  }}
                />
                {/* Service badge overlay (top-left when linked to order) */}
                {a.service_type && (
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                      {formatServiceType(a.service_type)}
                    </span>
                  </div>
                )}
                {/* Status badge overlay */}
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  <span className={`badge ${ANIMAL_STATUS_BADGE[a.status]}`} style={{ fontSize: '0.68rem' }}>
                    {ANIMAL_STATUS_LABEL[a.status]}
                  </span>
                </div>
                {/* Animal code overlay */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                  padding: '1rem 0.875rem 0.625rem',
                }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--aig-green-300)', fontSize: '0.875rem' }}>
                    {displayCode}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{a.breed} · {a.animal_type}</div>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: '0.875rem' }}>
                {/* Order / Holder / Programme linkage block */}
                {(a.order_ref || a.qurban_name_holder || a.programme) && (
                  <div style={{
                    marginBottom: '0.625rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: 8,
                    background: 'var(--surface-900)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}>
                    {a.order_ref && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Order Ref</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 600 }}>{a.order_ref}</span>
                      </div>
                    )}
                    {a.qurban_name_holder && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Qurban Holder</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.qurban_name_holder}
                        </span>
                      </div>
                    )}
                    {a.programme && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Programme</span>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.programme}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Share Allocation</span>
                      <span style={{ color: shareMeta.animals_per_share === 7 ? 'var(--gold-400)' : 'var(--text-secondary)', fontWeight: 600 }}>
                        {shareMeta.label}
                      </span>
                    </div>
                    {a.delivery_portion && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Portion</span>
                        <span style={{ color: 'var(--aig-green-300)', fontWeight: 600 }}>{formatDeliveryPortion(a.delivery_portion)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Weight bar (only for Breeding Programme / General Farm Stock) vs Approx. Weight */}
                {supportsWeightTimeline ? (
                  <div style={{ marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Weight size={11} /> Weight Timeline
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: belowMin ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {a.current_weight_kg}kg / {a.min_weight_kg}kg
                        {a.weight_history?.length ? ` (${a.weight_history.length})` : ''}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${weightPct}%`,
                        background: belowMin
                          ? 'linear-gradient(90deg, var(--danger), #f97316)'
                          : 'linear-gradient(90deg, var(--aig-green-600), var(--aig-green-400))',
                      }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Weight size={11} /> Approx. Weight
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{approxLabel}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>📍 {a.location}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{a.tag_number}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ color: 'var(--danger)', padding: '2px 4px', height: 22, minWidth: 22 }}
                      title={`Delete animal ${displayCode}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Permanently delete animal ${displayCode}? This cannot be undone.`)) {
                          deleteAnimal(a.id);
                          toast('success', 'Animal deleted', `Animal ${displayCode} removed from system.`);
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <h3>No animals found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}
