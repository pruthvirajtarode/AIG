import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Settings, Bell, Shield, Database, Globe, CreditCard, Save, ChevronRight } from 'lucide-react';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

function GeneralSettings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1.25rem' }}>Organisation Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Organisation Name</label>
            <input className="form-input" defaultValue="Al Ihsan Group" />
          </div>
          <div className="form-group">
            <label className="form-label">Slug</label>
            <input className="form-input" defaultValue="al-ihsan" />
          </div>
          <div className="form-group">
            <label className="form-label">Default Currency</label>
            <select className="form-input form-select" defaultValue="SGD">
              <option value="SGD">SGD — Singapore Dollar</option>
              <option value="MYR">MYR — Malaysian Ringgit</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Default Timezone</label>
            <select className="form-input form-select" defaultValue="Asia/Singapore">
              <option>Asia/Singapore</option>
              <option>Asia/Kuala_Lumpur</option>
              <option>UTC</option>
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="form-label">Contact Email</label>
            <input className="form-input" defaultValue="admin@alihsangroup.sg" type="email" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1.25rem' }}>Qurban Season Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Qurban Year</label>
            <input className="form-input" defaultValue="2025" type="number" />
          </div>
          <div className="form-group">
            <label className="form-label">Primary Qurban Date</label>
            <input className="form-input" type="date" defaultValue="2025-06-28" />
          </div>
          <div className="form-group">
            <label className="form-label">Registration Opens</label>
            <input className="form-input" type="date" defaultValue="2025-01-01" />
          </div>
          <div className="form-group">
            <label className="form-label">Registration Closes</label>
            <input className="form-input" type="date" defaultValue="2025-06-01" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const channels = [
    { name: 'Email', key: 'email', enabled: true },
    { name: 'WhatsApp', key: 'whatsapp', enabled: true },
    { name: 'SMS', key: 'sms', enabled: false },
    { name: 'In-App', key: 'in_app', enabled: true },
  ];
  const events = [
    { event: 'Order Created', email: true, whatsapp: true, sms: false },
    { event: 'Payment Submitted', email: true, whatsapp: true, sms: true },
    { event: 'Payment Verified', email: true, whatsapp: true, sms: false },
    { event: 'Payment Rejected', email: true, whatsapp: true, sms: true },
    { event: 'Animal Allocated', email: false, whatsapp: true, sms: false },
    { event: 'Qurban Complete', email: true, whatsapp: true, sms: false },
    { event: 'Delivery Scheduled', email: false, whatsapp: true, sms: false },
    { event: 'Certificate Ready', email: true, whatsapp: true, sms: false },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1.25rem' }}>Channel Configuration</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {channels.map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--surface-700)', borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {c.enabled ? 'Enabled — click to configure' : 'Disabled'}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={c.enabled} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{c.enabled ? 'On' : 'Off'}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1.25rem' }}>Notification Events</div>
        <div className="table-container" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th style={{ textAlign: 'center' }}>Email</th>
                <th style={{ textAlign: 'center' }}>WhatsApp</th>
                <th style={{ textAlign: 'center' }}>SMS</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.event}>
                  <td style={{ fontWeight: 500 }}>{e.event}</td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked={e.email} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked={e.whatsapp} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked={e.sms} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1.25rem' }}>Authentication</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { label: 'Two-Factor Authentication', desc: 'Require 2FA for all staff accounts', enabled: true },
            { label: 'Session Timeout', desc: 'Auto-logout after 8 hours of inactivity', enabled: true },
            { label: 'IP Allowlist', desc: 'Restrict staff access to specific IP ranges', enabled: false },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--surface-700)', borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{s.desc}</div>
              </div>
              <input type="checkbox" defaultChecked={s.enabled} />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1rem' }}>Data Retention</div>
        <div className="form-group">
          <label className="form-label">Audit Log Retention (days)</label>
          <input className="form-input" type="number" defaultValue="365" style={{ maxWidth: 180 }} />
        </div>
      </div>
    </div>
  );
}

function PlaceholderSettings({ title }: { title: string }) {
  return (
    <div className="card">
      <div className="empty-state" style={{ padding: '3rem' }}>
        <div className="empty-icon"><Settings size={24} color="var(--text-muted)" /></div>
        <h3>{title}</h3>
        <p>Configuration options for this section will be available in a future release.</p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  usePageTitle('Settings');
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration and preferences</p>
        </div>
        <button className="btn btn-primary">
          <Save size={16} />
          Save Changes
        </button>
      </div>

      <div className="content-grid-12">
        {/* Sidebar Nav */}
        <div className="card" style={{ padding: '0.5rem', height: 'fit-content' }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'none', justifyContent: 'flex-start', marginBottom: '0.125rem' }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="nav-icon" />
                <span>{tab.label}</span>
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </button>
            );
          })}
        </div>

        {/* Settings Content */}
        <div>
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'integrations' && <PlaceholderSettings title="Integrations" />}
          {activeTab === 'billing' && <PlaceholderSettings title="Billing & Subscriptions" />}
        </div>
      </div>
    </div>
  );
}
