import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import App from './App';
import './index.css';
import { isSupabaseConfigured } from '@/lib/supabase';

function SetupRequired() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', background: 'radial-gradient(circle at top, #0f3d2e, #070b0a)', color: '#e6f4ee' }}>
      <div style={{ maxWidth: 560, padding: '2.5rem', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 1rem' }}>AIGMS — Configuration required</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.6 }}>Supabase environment variables are missing. Add these in Vercel → Project → Settings → Environment Variables, then redeploy:</p>
        <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: 10, fontSize: '0.875rem' }}>{'VITE_SUPABASE_URL\nVITE_SUPABASE_ANON_KEY'}</pre>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {!isSupabaseConfigured ? <SetupRequired /> : (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
    )}
  </React.StrictMode>
);
