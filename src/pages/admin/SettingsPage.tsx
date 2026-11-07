import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Settings, Bell, Shield, Globe, CreditCard, Save, ChevronRight } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { OFFICIAL_WHATSAPP_DISPLAY, OFFICIAL_WHATSAPP_NUMBER } from '@/lib/orderRules';

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
    { name: `WhatsApp Business (Primary — ${OFFICIAL_WHATSAPP_DISPLAY})`, key: 'whatsapp', enabled: true, desc: 'Primary communication channel via Meta WhatsApp Cloud API' },
    { name: 'Email (One-Time Invoice + Automatic Fallback)', key: 'email', enabled: true, desc: 'Sends Order Confirmation & Invoice once, and acts as automatic fallback if WhatsApp delivery fails' },
    { name: 'Participant Portal (In-App + PDF Certificate Download)', key: 'in_app', enabled: true, desc: 'Participants view progress and download PDF Qurban Certificates directly from the portal' },
    { name: 'SMS', key: 'sms', enabled: false, desc: 'Disabled' },
  ];
  const events = [
    { event: 'Order Confirmation & Invoice (Sent Once)', email: true, whatsapp: true, rule: 'Email (once) + WhatsApp' },
    { event: 'Payment Notifications (Verified / Rejected)', email: false, whatsapp: true, rule: 'WhatsApp primary (Email fallback)' },
    { event: 'Qurban Status Updates (Allocated / Complete / Delivery)', email: false, whatsapp: true, rule: 'WhatsApp primary (Email fallback)' },
    { event: 'Indonesia Breeding Weight Updates', email: false, whatsapp: true, rule: 'WhatsApp primary (Email fallback)' },
    { event: 'Certificate-Ready Notification (Portal PDF Download Link)', email: false, whatsapp: true, rule: 'WhatsApp primary (Email fallback)' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '0.5rem' }}>Channel Priority & Fallback Policy</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          WhatsApp (<strong>{OFFICIAL_WHATSAPP_DISPLAY}</strong>) is configured as the primary channel, with automatic Email fallback whenever WhatsApp delivery fails. Order Confirmation &amp; Invoice is emailed once upon order creation.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {channels.map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.875rem 1rem', background: 'var(--surface-700)', borderRadius: 8 }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {c.desc}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" defaultChecked={c.enabled} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{c.enabled ? 'On' : 'Off'}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1.25rem' }}>Notification Routing Matrix</div>
        <div className="table-container" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th style={{ textAlign: 'center' }}>WhatsApp (Primary)</th>
                <th style={{ textAlign: 'center' }}>Direct Email</th>
                <th>Delivery Rule</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.event}>
                  <td style={{ fontWeight: 500 }}>{e.event}</td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked={e.whatsapp} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked={e.email} /></td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--aig-green-300)' }}>{e.rule}</td>
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

function IntegrationsSettings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '0.35rem' }}>Meta WhatsApp Cloud API</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Official Al Ihsan Group WhatsApp Business sender configured for primary notifications (with Email fallback). API tokens are stored server-side via environment secrets only.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Official Business Phone Number</label>
            <input className="form-input" defaultValue={OFFICIAL_WHATSAPP_NUMBER} style={{ fontFamily: 'monospace' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Connection Mode</label>
            <select className="form-input form-select" defaultValue="coexistence">
              <option value="coexistence">Meta Coexistence (WhatsApp Business App + Cloud API)</option>
              <option value="cloud_only">Dedicated Meta WhatsApp Cloud API</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Meta WhatsApp Business Account (WABA) ID</label>
            <input className="form-input" placeholder="e.g. 102938475610293" />
          </div>
          <div className="form-group">
            <label className="form-label">Meta Phone Number ID</label>
            <input className="form-input" placeholder="e.g. 109283746501928" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Portal Certificate Download Path</label>
            <input className="form-input" defaultValue="/portal/certificates" style={{ fontFamily: 'monospace' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="heading-md" style={{ marginBottom: '1rem' }}>Email Provider (One-Time Invoice + WhatsApp Fallback)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Sender Address</label>
            <input className="form-input" defaultValue="noreply@alihsangroup.sg" type="email" />
          </div>
          <div className="form-group">
            <label className="form-label">Fallback Policy</label>
            <input className="form-input" defaultValue="Automatic on WhatsApp delivery error" readOnly />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  usePageTitle('Settings');
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration and preferences</p>
        </div>
        <button className="btn btn-primary" onClick={() => toast('success', 'Settings saved', 'Communication and system preferences updated.')}>
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
          {activeTab === 'integrations' && <IntegrationsSettings />}
          {activeTab === 'billing' && <PlaceholderSettings title="Billing & Subscriptions" />}
        </div>
      </div>
    </div>
  );
}
