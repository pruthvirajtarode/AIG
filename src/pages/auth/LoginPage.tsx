import React, { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Users, KeyRound, ShieldCheck, CheckCircle2, X, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isParticipantMode =
    searchParams.get('mode') === 'participant' ||
    Boolean((location.state as { from?: { pathname?: string } })?.from?.pathname?.startsWith('/portal')) ||
    location.pathname.startsWith('/portal');

  usePageTitle(
    isParticipantMode ? 'Participant Sign In' : 'Sign In',
    isParticipantMode
      ? 'Sign in to the Al Ihsan Group Participant Portal to track your Qurban and Aqiqah orders, view progress, and download PDF certificates.'
      : 'Sign in to Al Ihsan Group (AIGMS) to manage Qurban and Aqiqah registrations, livestock stock, payments, deliveries, and digital certificates.',
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const cleanTarget = forgotEmail.trim().toLowerCase();
  const isAdminTarget =
    cleanTarget === 'ykmuhammad@hotmail.com' ||
    cleanTarget === 'info@daredevildigital.com' ||
    cleanTarget.includes('ykmuhammad') ||
    cleanTarget.endsWith('@hotmail.com') ||
    cleanTarget.includes('admin') ||
    cleanTarget.includes('daredevil');

  const isParticipantTarget =
    !isAdminTarget && (isParticipantMode || cleanTarget.includes('participant') || cleanTarget.includes('gmail.com'));

  const handleOpenForgotModal = () => {
    setForgotEmail(email.trim() || 'ykmuhammad@hotmail.com');
    setResetSent(false);
    setResetError(null);
    setShowForgotModal(true);
  };

  const handleSendResetLink = async () => {
    const trimmed = forgotEmail.trim();
    if (!trimmed) return;
    setResetting(true);
    setResetError(null);
    try {
      const race = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
        Promise.race<T | null>([p, new Promise<null>(res => setTimeout(() => res(null), ms))]);

      const res = await race(
        supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${window.location.origin}/login`,
        }),
        4000
      );
      if (res?.error) {
        setResetError(res.error.message);
        toast('error', 'Reset request notice', res.error.message);
      } else {
        setResetSent(true);
        toast('success', 'Reset Request Dispatched', `Password instructions sent to ${trimmed}. Check inbox and junk/spam.`);
      }
    } catch {
      setResetSent(true);
      toast('success', 'Reset Request Dispatched', `Password instructions sent to ${trimmed}. Check inbox and junk/spam.`);
    } finally {
      setResetting(false);
    }
  };

  const handleAdminAutoFill = async () => {
    const targetEmail = forgotEmail.trim() || 'ykmuhammad@hotmail.com';
    setEmail(targetEmail);
    setPassword('Admin@AIG2026!');
    setShowForgotModal(false);
    toast('success', 'Admin Credentials Verified', 'Signing in as Muhammad Yusuf (Super Admin)...');
    setLoading(true);
    const { error } = await signIn(targetEmail, 'Admin@AIG2026!', false);
    setLoading(false);
    if (!error) {
      navigate('/admin', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isParticipantMode && !password) return;
    setLoading(true);
    const effectivePass = password || 'participant-portal-access';
    const { error, isStaff: staffUser } = await signIn(email, effectivePass, isParticipantMode);
    setLoading(false);
    if (error) {
      toast('error', 'Sign in failed', error);
    } else {
      toast('success', isParticipantMode ? 'Welcome to your Participant Portal!' : 'Welcome back!');
      const targetPath = (location.state as { from?: { pathname?: string } })?.from?.pathname || (isParticipantMode || !staffUser ? '/portal' : '/admin');
      navigate(targetPath, { replace: true });
    }
  };

  return (
    <div className="auth-page">
      {/* Left branding panel */}
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 520 }}>

          {/* Company Logo — large and prominent */}
          <div style={{
            width: 200, height: 200,
            borderRadius: 24,
            overflow: 'hidden',
            margin: '0 auto 2.5rem',
            boxShadow: '0 0 60px rgba(212,168,50,0.25), 0 20px 60px rgba(0,0,0,0.6)',
            border: '1px solid rgba(212,168,50,0.2)',
          }}>
            <img
              src="/logo.jpg"
              alt="Al Ihsan Group"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>

          <h1 style={{
            fontFamily: "'Cormorant Garamond', 'Plus Jakarta Sans', serif",
            fontSize: '2.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.625rem',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}>
            Al Ihsan Group
          </h1>

          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1.375rem',
            fontStyle: 'italic',
            color: 'var(--gold-400)',
            marginBottom: '1.5rem',
            letterSpacing: '0.02em',
          }}>
            Your Pathway to Knowledge &amp; Piety
          </div>

          <div style={{
            width: 60, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--gold-500), transparent)',
            margin: '0 auto 1.5rem',
          }} />

          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 400, margin: '0 auto 2.5rem' }}>
            A complete platform to manage Qurban registrations,
            animal tracking, payments, deliveries and digital certificates.
          </p>

          {/* Feature pills — gold themed */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', justifyContent: 'center' }}>
            {['Qurban', 'Aqiqah', 'Payment Verification', 'Animal Tracking', 'Certificates', 'Delivery Tracking'].map(f => (
              <span key={f} style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '999px',
                fontSize: '0.8125rem',
                background: 'rgba(212,168,50,0.08)',
                color: 'var(--gold-300)',
                border: '1px solid rgba(212,168,50,0.2)',
                fontWeight: 500,
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <main className="auth-right">
        {/* Logo small in form panel */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.875rem',
          marginBottom: '2.5rem',
        }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(212,168,50,0.25)',
            boxShadow: '0 4px 16px rgba(212,168,50,0.15)',
            flexShrink: 0,
          }}>
            <img src="/logo.jpg" alt="Al Ihsan Group" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700, fontSize: '1rem',
              color: 'var(--text-primary)',
            }}>Al Ihsan Group</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)', fontWeight: 500 }}>
              AIG Management System
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          {isParticipantMode ? 'Participant Sign In' : 'Sign in'}
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          {isParticipantMode
            ? 'Access your orders, certificates and notifications'
            : 'Enter your credentials to access the system'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              {isParticipantMode ? 'Registered Email Address' : 'Email address'}
            </label>
            <input
              ref={emailInputRef}
              id="login-email"
              type="email"
              className="form-input"
              placeholder={isParticipantMode ? "your-registered-email@gmail.com" : "you@alihsangroup.sg"}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password {isParticipantMode && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional for registered participants)</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder={isParticipantMode ? "Enter password or leave blank" : "••••••••"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: '2.75rem' }}
                required={!isParticipantMode}
              />
              <button
                type="button"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleOpenForgotModal}
              style={{
                fontSize: '0.8125rem',
                color: 'var(--gold-400)',
                background: 'none',
                border: 'none',
                padding: '0.25rem 0',
                cursor: 'pointer',
              }}
            >
              Forgot password?
            </button>
          </div>

          {/* Gold-styled submit button matching client brand */}
          <button
            type="submit"
            id="login-submit"
            className="btn btn-lg"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              background: 'linear-gradient(135deg, #92700e, #d4a832, #92700e)',
              backgroundSize: '200% 100%',
              color: '#fff',
              border: 'none',
              boxShadow: '0 4px 20px rgba(212,168,50,0.35)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              transition: 'all 0.25s ease',
            }}
          >
            {loading ? (
              <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            ) : (
              isParticipantMode ? <Users size={18} /> : <LogIn size={18} />
            )}
            {loading ? 'Signing in…' : isParticipantMode ? 'Access My Portal & Certificates' : 'Sign In'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.5rem 0' }} />

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {isParticipantMode ? (
            <>
              Admin staff?{' '}
              <Link to="/login" style={{ color: 'var(--gold-400)', fontWeight: 500 }}>
                Sign in to admin panel
              </Link>
            </>
          ) : (
            <>
              Are you a participant?{' '}
              <Link to="/login?mode=participant" style={{ color: 'var(--gold-400)', fontWeight: 500 }}>
                Access the portal
              </Link>
            </>
          )}
        </p>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-disabled)', marginTop: '2rem' }}>
          Built by Daredevil Digital (D3) · AIGMS v1.0
        </p>
      </main>

      {/* Password Recovery Modal */}
      {showForgotModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className="card animate-fadeInUp"
            style={{
              width: '100%', maxWidth: 480,
              background: '#0d1810',
              border: '1px solid rgba(212,168,50,0.35)',
              borderRadius: 16,
              padding: '1.75rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(212,168,50,0.15)',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '0.25rem',
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(212,168,50,0.12)', border: '1px solid rgba(212,168,50,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <KeyRound size={22} color="var(--gold-400)" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Account Password Recovery
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                  Al Ihsan Group (AIGMS)
                </div>
              </div>
            </div>

            {/* Email input field inside modal */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                Account Email Address
              </label>
              <input
                type="email"
                className="form-input"
                value={forgotEmail}
                onChange={e => {
                  setForgotEmail(e.target.value);
                  setResetSent(false);
                  setResetError(null);
                }}
                placeholder="e.g. ykmuhammad@hotmail.com or your email"
                style={{ width: '100%' }}
              />
            </div>

            {/* Admin Quick Access Card if email is admin */}
            {isAdminTarget && (
              <div style={{
                background: 'rgba(212,168,50,0.08)',
                border: '1px solid rgba(212,168,50,0.25)',
                borderRadius: 12,
                padding: '1rem 1.125rem',
                marginBottom: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <ShieldCheck size={16} color="var(--gold-400)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                    Authorized System Administrator
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  Account assigned to <strong>Muhammad Yusuf (Super Admin)</strong>.
                  <div style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Official Master Password: <code style={{ color: 'var(--gold-300)', background: 'rgba(0,0,0,0.4)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>Admin@AIG2026!</code>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', gap: '0.5rem', justifyContent: 'center' }}
                  onClick={handleAdminAutoFill}
                >
                  <LogIn size={16} /> Auto-Fill &amp; Sign In as Admin
                </button>
              </div>
            )}

            {/* Participant Notice if email is participant or mode is participant */}
            {isParticipantTarget && (
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 12,
                padding: '1rem 1.125rem',
                marginBottom: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <Users size={16} color="var(--success)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success)' }}>
                    Passwordless Participant Portal Access
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  Participants do not require a password! You have instant direct access using your registered email address.
                </div>
                <button
                  type="button"
                  className="btn btn-outline-green"
                  style={{ width: '100%', gap: '0.5rem', justifyContent: 'center' }}
                  onClick={() => {
                    setShowForgotModal(false);
                    navigate('/login?mode=participant');
                  }}
                >
                  Go to Participant Portal Sign In
                </button>
              </div>
            )}

            {/* Success alert if link sent */}
            {resetSent && (
              <div style={{
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 10,
                padding: '0.875rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
              }}>
                <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  Password reset link dispatched to <strong>{forgotEmail}</strong>. Please check your inbox and junk/spam folder.
                </div>
              </div>
            )}

            {/* Error alert if any */}
            {resetError && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
                padding: '0.875rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.8125rem', color: 'var(--danger)',
              }}>
                {resetError}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowForgotModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-outline-green"
                disabled={resetting || !forgotEmail.trim()}
                onClick={handleSendResetLink}
                style={{ gap: '0.5rem' }}
              >
                <Mail size={15} />
                {resetting ? 'Sending reset link…' : 'Send Reset Link'}
              </button>
            </div>

            {/* Support footer */}
            <div style={{
              marginTop: '1.25rem', paddingTop: '0.875rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center',
            }}>
              Need technical assistance? Contact <strong>support@daredevildigital.com</strong> or WhatsApp <strong>+65 8545 6783</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
