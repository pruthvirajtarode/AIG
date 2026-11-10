import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Settings, Bell, Shield, Globe, CreditCard, Save, ChevronRight, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { OFFICIAL_WHATSAPP_DISPLAY, OFFICIAL_WHATSAPP_NUMBER } from '@/lib/orderRules';
import { notificationService, WHATSAPP_TEMPLATE_REGISTRY } from '@/services/notificationService';

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
        <div className="heading-md" style={{ marginBottom: '0.5rem' }}>Qurban Season Settings (1447H / 2026)</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Configurable season dates for 1447H / 2026. Final slaughter dates and programme pricing remain editable via Programmes &amp; Settings upon final client confirmation.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Qurban Year (Gregorian / Hijri)</label>
            <input className="form-input" defaultValue="2026" type="number" />
          </div>
          <div className="form-group">
            <label className="form-label">Primary Qurban Date (10 Zulhijjah 1447H)</label>
            <input className="form-input" type="date" defaultValue="2026-05-27" />
          </div>
          <div className="form-group">
            <label className="form-label">Registration Opens</label>
            <input className="form-input" type="date" defaultValue="2026-01-01" />
          </div>
          <div className="form-group">
            <label className="form-label">Registration Closes</label>
            <input className="form-input" type="date" defaultValue="2026-05-20" />
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
  const { toast } = useToast();
  const [diagTick, setDiagTick] = useState(0);
  const [testPhone, setTestPhone] = useState('+6591234567');
  const [testEmail, setTestEmail] = useState('admin@alihsangroup.sg');
  const [sendingTest, setSendingTest] = useState(false);

  void diagTick;
  const diag = notificationService.getDiagnostics();
  const recentLogs = notificationService.getDeliveryLogs().slice(0, 6);
  const templates = Object.values(WHATSAPP_TEMPLATE_REGISTRY);

  const isLiveConnected =
    diag.whatsappConnectionStatus === 'connected' ||
    diag.whatsappConnectionStatus === 'edge_function_configured';

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      const res = await notificationService.sendAdminTestNotification({
        recipientName: 'AIG Staff Admin',
        recipientPhone: testPhone,
        recipientEmail: testEmail,
      });
      setDiagTick(t => t + 1);
      if (res.isSimulated) {
        toast(
          'warning',
          'Sandbox Test Logged (Not Connected to Live Meta API)',
          `Delivery state: "${res.deliveryState}". Configure the whatsapp-send Edge Function secrets to enable live Cloud API delivery.`,
        );
      } else if (res.success) {
        toast('success', 'Test Notification Accepted by Provider', `Channel: ${res.channelUsed} · State: ${res.deliveryState}`);
      } else {
        toast('error', 'Test Notification Failed', res.error || 'Provider rejected test notification');
      }
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="integrations-settings-panel">
      {/* Live Diagnostics Banner */}
      <div
        className="card"
        style={{
          border: isLiveConnected ? '1px solid rgba(77,170,128,0.4)' : '1px solid rgba(212,168,50,0.45)',
          background: isLiveConnected ? 'rgba(77,170,128,0.06)' : 'rgba(212,168,50,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {isLiveConnected ? (
              <CheckCircle2 size={20} color="var(--status-success)" />
            ) : (
              <AlertTriangle size={20} color="var(--gold-400)" />
            )}
            <div>
              <div className="heading-md">WhatsApp Integration &amp; Delivery Diagnostics</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Real-time connection status, webhook health, and queue metrics. Permanent Meta tokens and App Secrets are restricted to server-side Supabase Edge Functions.
              </div>
            </div>
          </div>
          <span
            className={`badge ${isLiveConnected ? 'badge-success' : 'badge-warning'}`}
            data-testid="whatsapp-connection-status-badge"
          >
            {diag.whatsappStatusLabel}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>WhatsApp Provider Mode</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              {diag.providerType}
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Official Sender (Masked)</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              {diag.maskedPhoneNumber} ({diag.officialPhoneNumber})
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>WABA &amp; Coexistence Status</div>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', marginTop: '0.2rem', color: 'var(--gold-400)' }}>
              {diag.businessAccountStatus}
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Template Readiness</div>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', marginTop: '0.2rem' }}>
              {diag.templateReadiness}
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Webhook Health</div>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', marginTop: '0.2rem' }}>
              {diag.webhookHealth}
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Fallback Provider</div>
            <div style={{ fontWeight: 600, fontSize: '0.78rem', marginTop: '0.2rem' }}>
              {diag.emailProviderStatus}
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Successful / Simulated</div>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              {diag.lastSuccessfulMessage ? new Date(diag.lastSuccessfulMessage.createdAt).toLocaleString() : 'None recorded'}
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Failed Message</div>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', marginTop: '0.2rem', fontFamily: 'var(--font-mono)', color: diag.lastFailedMessage ? 'var(--status-danger)' : undefined }}>
              {diag.lastFailedMessage ? new Date(diag.lastFailedMessage.createdAt).toLocaleString() : '0 failures'}
            </div>
          </div>
        </div>

        {/* Queue Metrics */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <span>Total Dispatched: <strong>{diag.queueSummary.totalLogged}</strong></span>
          <span>Accepted by Provider: <strong>{diag.queueSummary.acceptedOrSent}</strong></span>
          <span>Delivered / Read: <strong>{diag.queueSummary.deliveredOrRead}</strong></span>
          <span>Email Fallbacks: <strong>{diag.queueSummary.fallbackCompleted}</strong></span>
          <span>Simulated (Sandbox): <strong>{diag.queueSummary.simulatedCount}</strong></span>
          <span>Failed: <strong>{diag.queueSummary.failedCount}</strong></span>
        </div>
      </div>

      {/* Meta Cloud API Configuration (Read-Only Secrets Notice) */}
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '0.35rem' }}>Meta WhatsApp Cloud API Endpoint Configuration</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Official Al Ihsan Group WhatsApp Business sender (<strong>{OFFICIAL_WHATSAPP_DISPLAY}</strong>). Permanent System User Access Tokens and App Secrets are never stored in browser state — set them via <code>supabase secrets set</code> for <code>whatsapp-send</code> and <code>whatsapp-webhook</code>.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
          <div className="form-group">
            <label className="form-label">Official Business Phone Number (E.164)</label>
            <input className="form-input" value={OFFICIAL_WHATSAPP_NUMBER} readOnly style={{ fontFamily: 'monospace' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Onboarding Architecture</label>
            <select className="form-input form-select" defaultValue="coexistence">
              <option value="coexistence">Option A — Meta Coexistence (Keep WhatsApp Business App on +65 8545 6783 + Cloud API)</option>
              <option value="cloud_only">Option B — Dedicated Meta WhatsApp Cloud API Migration</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Outbound Edge Function</label>
            <input className="form-input" value="supabase/functions/whatsapp-send" readOnly style={{ fontFamily: 'monospace' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Webhook Receiver Edge Function (HMAC-SHA256 Verified)</label>
            <input className="form-input" value="supabase/functions/whatsapp-webhook" readOnly style={{ fontFamily: 'monospace' }} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Portal Certificate Download Path</label>
            <input className="form-input" value="/portal/certificates" readOnly style={{ fontFamily: 'monospace' }} />
          </div>
        </div>
      </div>

      {/* Controlled Admin Test Notification */}
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '0.35rem' }}>Controlled Admin Test Notification</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Test the WhatsApp primary + Email fallback pipeline and inspect the resulting delivery state (<code>accepted_by_provider</code> vs <code>simulated</code>).
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }} className="settings-grid-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Test Recipient Phone (E.164)</label>
            <input
              className="form-input"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="+6591234567"
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Fallback Email Address</label>
            <input
              className="form-input"
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="admin@alihsangroup.sg"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSendTest}
            disabled={sendingTest}
            data-testid="send-test-notification-btn"
          >
            <Send size={15} />
            {sendingTest ? 'Dispatching…' : 'Send Test Notification'}
          </button>
        </div>

        {recentLogs.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Recent Notification Delivery Log
            </div>
            <div className="table-container" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Recipient</th>
                    <th>Channel</th>
                    <th>Delivery State</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{log.eventType || log.templateId || 'notification'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{log.recipientPhoneE164 || log.recipientEmail || log.recipientName}</td>
                      <td style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>{log.channelUsed}</td>
                      <td>
                        <span className={`badge ${log.deliveryState === 'delivered' || log.deliveryState === 'accepted_by_provider' ? 'badge-success' : log.deliveryState === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                          {log.deliveryState}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.isSimulated ? 'Sandbox (Simulated)' : 'Live Cloud API'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Approved WhatsApp Utility Template Registry (11 Events) */}
      <div className="card">
        <div className="heading-md" style={{ marginBottom: '0.35rem' }}>WhatsApp Utility Template Registry ({diag.approvedTemplateCount} Templates)</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Pre-validated Meta WhatsApp Business Utility templates required for production approval under Al Ihsan Group&apos;s WABA.
        </div>
        <div className="table-container" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Meta Template Name</th>
                <th>Category</th>
                <th>Variables</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.templateId}>
                  <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.description}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gold-400)' }}>{t.metaTemplateName}</td>
                  <td><span className="badge badge-info">{t.category}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {t.requiredVariables.map((v, i) => `{{${i + 1}}}=${v}`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
