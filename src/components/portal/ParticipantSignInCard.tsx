import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Search, Award, ShieldAlert, ArrowRight, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface ParticipantSignInCardProps {
  title?: string;
  subtitle?: string;
  onSuccess?: (name?: string) => void;
  signIn: (identifier: string) => Promise<{ success: boolean; error?: string; name?: string }>;
  isStaffUser?: boolean;
  actionLabel?: string;
}

export function ParticipantSignInCard({
  title = 'Participant Portal Access',
  subtitle = 'Enter your registered email address or Order Reference to access your Qurban/Aqiqah bookings, view real-time status updates, and download your official digital certificates.',
  onSuccess,
  signIn,
  isStaffUser = false,
  actionLabel = 'Access Portal',
}: ParticipantSignInCardProps) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = identifier.trim();
    if (!clean) {
      setErrorMsg('Please enter your registered email address or Order Reference.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await signIn(clean);
      if (res.success) {
        toast('success', `Welcome${res.name ? `, ${res.name}` : ''}!`, 'Your participant portal has been loaded.');
        if (onSuccess) onSuccess(res.name);
      } else {
        setErrorMsg(res.error || 'No matching booking found. Please check your email or order reference.');
      }
    } catch {
      setErrorMsg('Unable to verify at this moment. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 620,
        margin: '2rem auto',
        padding: 'clamp(1.25rem, 3.5vw, 2.25rem)',
        background: 'linear-gradient(160deg, rgba(16,28,20,0.85) 0%, rgba(10,18,12,0.95) 100%)',
        border: '1px solid rgba(212,168,50,0.3)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 30px rgba(212,168,50,0.06)',
      }}
    >
      {/* Staff preview banner if logged in as staff */}
      {isStaffUser && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(212,168,50,0.1)',
            border: '1px solid rgba(212,168,50,0.25)',
            borderRadius: 10,
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <ShieldAlert size={18} color="#d4a832" />
            <span style={{ fontSize: '0.8125rem', color: '#f5f0e8' }}>
              <strong>Staff View:</strong> Enter a participant's registered email or Order Reference to preview their portal.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="btn btn-secondary btn-sm"
            style={{ gap: '0.375rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
          >
            <LayoutDashboard size={13} />
            Return to Admin Panel
          </button>
        </div>
      )}

      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 14,
            overflow: 'hidden',
            margin: '0 auto 1rem',
            border: '1px solid rgba(212,168,50,0.35)',
            boxShadow: '0 0 25px rgba(212,168,50,0.15)',
          }}
        >
          <img
            src="/logo.jpg"
            alt="Al Ihsan Group"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#d4a832',
            letterSpacing: '0.01em',
            marginBottom: '0.375rem',
          }}
        >
          {title}
        </div>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, margin: 0 }}>
          {subtitle}
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.25rem' }}>
          <label
            htmlFor="participant-identifier-input"
            style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            Registered Email Address or Order Reference
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '0.875rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Mail size={16} />
            </span>
            <input
              id="participant-identifier-input"
              type="text"
              className="form-input"
              placeholder="e.g. name@example.com or ORD-10010"
              value={identifier}
              onChange={e => {
                setIdentifier(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              autoFocus
              style={{
                paddingLeft: '2.5rem',
                height: '46px',
                fontSize: '0.9375rem',
                borderColor: errorMsg ? 'var(--danger)' : undefined,
              }}
            />
          </div>
          {errorMsg && (
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8125rem',
                color: '#f87171',
                lineHeight: 1.4,
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !identifier.trim()}
          style={{
            width: '100%',
            height: '46px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {loading ? (
            <span>Verifying booking…</span>
          ) : (
            <>
              <span>{actionLabel}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Helpful Hint */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        💡 <strong>Tip:</strong> Use the email address you entered when booking your Qurban/Aqiqah, or copy the Order Reference from your WhatsApp confirmation notification.
      </div>
    </div>
  );
}
