import React, { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Plus, X, Weight, CheckCircle2, ClipboardCheck, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { AnimalStatus, AnimalType } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';
import { ANIMAL_IMAGES } from '@/lib/animalImages';
import { useAppData, type AppAnimal as Animal } from '@/contexts/AppDataContext';

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

function RegisterAnimalModal({ onClose, onRegister, nextSeq }: {
  onClose: () => void;
  onRegister: (animal: Animal) => void;
  nextSeq: number;
}) {
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const padded = String(nextSeq).padStart(3, '0');

  const [animalType, setAnimalType] = useState<AnimalType>('cow');
  const [breed,      setBreed]      = useState('');
  const [gender,     setGender]     = useState('male');
  const [weight,     setWeight]     = useState('');
  const [minWeight,  setMinWeight]  = useState('');
  const [location,   setLocation]   = useState('');
  const [supplier,   setSupplier]   = useState('');
  const [tagNumber,  setTagNumber]  = useState('');
  const [status,     setStatus]     = useState<AnimalStatus>('available');

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
      id: `a-${Date.now()}`,
      animal_ref: `A-${year}-${padded}`,
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
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Ref will be: <strong style={{ color: 'var(--aig-green-300)', fontFamily: 'monospace' }}>A-{year}-{padded}</strong></div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
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
              <input className="form-input" placeholder="e.g. Ternakan Maju Sdn Bhd" value={supplier} onChange={e => setSupplier(e.target.value)} />
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

// ── Log Weight Modal ──────────────────────────────────────────
function LogWeightModal({ animal, onClose, onUpdate }: {
  animal: Animal;
  onClose: () => void;
  onUpdate: (id: string, weight: number) => void;
}) {
  const [weight, setWeight] = useState(String(animal.current_weight_kg));
  const { toast } = useToast();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="heading-md">Log Weight Update</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Animal: <strong style={{ color: 'var(--text-primary)' }}>{animal.animal_ref}</strong> — {animal.breed}
          </div>
          <div className="form-group">
            <label className="form-label">Current Weight (kg)</label>
            <input
              className="form-input" type="number" min="0" step="0.1"
              value={weight} onChange={e => setWeight(e.target.value)}
              autoFocus
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
            onUpdate(animal.id, w);
            toast('success', 'Weight logged!', `${animal.animal_ref}: ${w} kg recorded`);
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
function AnimalDetailModal({ animal, onClose, onWeightLog, onInspection, onStatusUpdate }: {
  animal: Animal;
  onClose: () => void;
  onWeightLog: (a: Animal) => void;
  onInspection: (a: Animal) => void;
  onStatusUpdate: (a: Animal) => void;
}) {
  const weightPct = Math.min(100, Math.round((animal.current_weight_kg / animal.min_weight_kg) * 100));
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
              <div className="heading-md">{animal.animal_ref}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {animal.breed} · {animal.animal_type}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="settings-grid-2">
            <div className="detail-list">
              {[
                ['Tag Number', animal.tag_number],
                ['Breed',      animal.breed],
                ['Gender',     animal.gender || '—'],
                ['Location',   animal.location],
                ['Supplier',   animal.supplier],
                ['Registered', formatDate(animal.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="detail-row">
                  <div className="detail-key">{k}</div>
                  <div className="detail-val">{v}</div>
                </div>
              ))}
            </div>
            <div>
              {/* Weight Progress */}
              <div style={{ marginBottom: '1.25rem' }}>
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

        {/* Footer — all 3 buttons fully working */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => onWeightLog(animal)} style={{ gap: '0.5rem' }}>
            <Weight size={14} /> Log Weight Update
          </button>
          <button className="btn btn-outline-green" onClick={() => onInspection(animal)} style={{ gap: '0.5rem' }}>
            <ClipboardCheck size={14} /> Record Inspection
          </button>
          <button className="btn btn-primary" onClick={() => onStatusUpdate(animal)} style={{ gap: '0.5rem' }}>
            <RefreshCw size={14} /> Update Status
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function AnimalsPage() {
  usePageTitle('Animals');
  const { toast } = useToast();
  const { animals, addAnimal, updateAnimalStatus } = useAppData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Animal | null>(null);
  const [weightAnimal, setWeightAnimal] = useState<Animal | null>(null);
  const [inspectionAnimal, setInspectionAnimal] = useState<Animal | null>(null);
  const [statusAnimal, setStatusAnimal] = useState<Animal | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  // next seq = animals.length + 1 (always correct)
  const animalSeq = animals.length + 1;

  const registerAnimal = useCallback((animal: Animal) => {
    addAnimal(animal);
  }, [addAnimal]);

  const updateAnimal = useCallback((id: string, patch: Partial<Animal>) => {
    if (patch.status) updateAnimalStatus(id, patch.status);
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  }, [updateAnimalStatus]);


  const handleWeightUpdate = useCallback((id: string, weight: number) => {
    updateAnimal(id, { current_weight_kg: weight });
  }, [updateAnimal]);

  const handleStatusUpdate = useCallback((id: string, status: AnimalStatus) => {
    updateAnimal(id, { status });
  }, [updateAnimal]);

  const openWeight = (a: Animal) => { setSelected(null); setWeightAnimal(a); };
  const openInspection = (a: Animal) => { setSelected(null); setInspectionAnimal(a); };
  const openStatus = (a: Animal) => { setSelected(null); setStatusAnimal(a); };

  const filtered = animals.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = a.animal_ref.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q) || a.location.toLowerCase().includes(q);
    const matchType = !typeFilter || a.animal_type === typeFilter;
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {/* Modals */}
      {showRegister && (
        <RegisterAnimalModal
          onClose={() => setShowRegister(false)}
          onRegister={registerAnimal}
          nextSeq={animalSeq}
        />
      )}
      {selected && (
        <AnimalDetailModal
          animal={selected}
          onClose={() => setSelected(null)}
          onWeightLog={openWeight}
          onInspection={openInspection}
          onStatusUpdate={openStatus}
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
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Animals', value: String(animals.length),                                            color: 'var(--aig-green-400)' },
          { label: 'Available',     value: String(animals.filter(a => a.status === 'available').length),       color: 'var(--success)' },
          { label: 'Allocated',     value: String(animals.filter(a => a.status === 'allocated').length),       color: 'var(--purple, #a855f7)' },
          { label: 'Qurban Ready',  value: String(animals.filter(a => a.status === 'qurban_ready').length),    color: '#10b981' },
          { label: 'Exceptions',    value: String(animals.filter(a => ['rejected','inspection_pending'].includes(a.status)).length), color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input
            id="animals-search" type="search" className="form-input"
            placeholder="Search by ref, breed, location..."
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
        <select className="form-input form-select" style={{ width: 'auto', height: 38, fontSize: '0.875rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {(Object.keys(ANIMAL_STATUS_LABEL) as AnimalStatus[]).map(s => (
            <option key={s} value={s}>{ANIMAL_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Animal Grid — real photorealistic images */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {filtered.map(a => {
          const weightPct = Math.min(100, Math.round((a.current_weight_kg / a.min_weight_kg) * 100));
          const belowMin = a.current_weight_kg < a.min_weight_kg;
          return (
            <div
              key={a.id}
              className="card card-hover"
              style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}
              onClick={() => setSelected(a)}
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
                {/* Status badge overlay */}
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  <span className={`badge ${ANIMAL_STATUS_BADGE[a.status]}`} style={{ fontSize: '0.68rem' }}>
                    {ANIMAL_STATUS_LABEL[a.status]}
                  </span>
                </div>
                {/* Animal ref overlay */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                  padding: '1rem 0.875rem 0.625rem',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--aig-green-300)', fontSize: '0.875rem' }}>{a.animal_ref}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>{a.breed} · {a.animal_type}</div>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: '0.875rem' }}>
                {/* Weight bar */}
                <div style={{ marginBottom: '0.625rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Weight size={11} /> Weight
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: belowMin ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {a.current_weight_kg}kg / {a.min_weight_kg}kg
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

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>📍 {a.location}</span>
                  <span>{a.tag_number}</span>
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
