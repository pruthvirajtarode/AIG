import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Leaf } from 'lucide-react';
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
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 480 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: 'linear-gradient(135deg, var(--aig-green-700), var(--aig-green-500))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 2rem',
            boxShadow: '0 12px 40px rgba(31,133,97,0.5)',
          }}>
            <Leaf size={36} color="#fff" />
          </div>

          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '2.5rem', fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            lineHeight: 1.15,
          }}>
            Al Ihsan Group<br />
            <span style={{ color: 'var(--aig-green-300)' }}>Qurban Management</span>
          </h1>

          <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            A complete platform to manage Qurban registrations, animal tracking,
            payments, deliveries, and digital certificates.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', justifyContent: 'center' }}>
            {['Order Management', 'Payment Verification', 'Animal Tracking', 'Certificate Generation', 'Delivery Tracking', 'Multi-tenant'].map(f => (
              <span key={f} style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '999px',
                fontSize: '0.8125rem',
                background: 'rgba(47,168,118,0.1)',
                color: 'var(--aig-green-300)',
                border: '1px solid rgba(47,168,118,0.2)',
                fontWeight: 500,
              }}>{f}</span>
            ))}
          </div>

          {/* Decorative orb */}
          <div style={{
            position: 'absolute',
            width: 300, height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,168,50,0.08), transparent)',
            bottom: -120, right: -80,
            pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* Right login form */}
      <div className="auth-right">
        <div className="auth-logo">A</div>

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
              placeholder="you@example.com"
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
            <a href="#" style={{ fontSize: '0.8125rem', color: 'var(--aig-green-400)' }}>
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            id="login-submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
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
          <Link to="/portal" style={{ color: 'var(--aig-green-400)', fontWeight: 500 }}>
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
