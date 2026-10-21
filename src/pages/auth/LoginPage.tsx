import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast('error', 'Sign in failed', error);
    } else {
      toast('success', 'Welcome back!');
      navigate('/admin');
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
            Your Pathway to Knowledge & Piety
          </div>

          <div style={{
            width: 60, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--gold-500), transparent)',
            margin: '0 auto 1.5rem',
          }} />

          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '2.5rem', maxWidth: 400, margin: '0 auto 2.5rem' }}>
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
      <div className="auth-right">
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
              Qurban Management System
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          Sign in
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Enter your credentials to access the system
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@alihsangroup.sg"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: '2.75rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <a href="#" style={{ fontSize: '0.8125rem', color: 'var(--gold-400)' }}>
              Forgot password?
            </a>
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
              <LogIn size={18} />
            )}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.5rem 0' }} />

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Are you a participant?{' '}
          <Link to="/portal" style={{ color: 'var(--gold-400)', fontWeight: 500 }}>
            Access the portal
          </Link>
        </p>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-disabled)', marginTop: '2rem' }}>
          Built by Daredevil Digital (D3) · AIGMS v1.0
        </p>
      </div>
    </div>
  );
}
