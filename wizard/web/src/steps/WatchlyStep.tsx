import { useState, type CSSProperties } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { WizardShell } from '../components/WizardShell';
import { NextButton } from '../components/NextButton';
import { useWizard } from '../store/wizard';
import { resolveLogoUrl } from '../lib/services';

// @ts-ignore
import { createStremioAdapter } from '@core/adapters/stremio.js';

export function WatchlyStep() {
  const {
    target, stremioAccount, watchly,
    setWatchly, nextStep,
  } = useWizard();

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState(watchly.nuvioStremioLogin?.email ?? '');
  const [loginPassword, setLoginPassword] = useState(watchly.nuvioStremioLogin?.password ?? '');
  const [loginError, setLoginError] = useState('');

  const isNuvio = target === 'nuvio';
  const canContinue = !watchly.enabled || (isNuvio ? !!watchly.nuvioStremioLogin : !!stremioAccount.authKey);

  const inputStyle: CSSProperties = {
    marginTop: '0.35rem', width: '100%',
    border: '1px solid var(--border)', borderRadius: '8px',
    padding: '0.5rem 0.75rem', fontSize: '0.875rem',
    background: 'var(--panel)', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box',
  };

  async function handleNuvioLogin() {
    if (!loginEmail.includes('@') || loginPassword.length < 4) {
      setLoginError('Please enter a valid email and password (min. 4 characters).');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const adapter = createStremioAdapter();
      const auth = await adapter.login(loginEmail, loginPassword);
      setWatchly({
        nuvioStremioLogin: {
          email: loginEmail,
          password: loginPassword,
          authKey: auth.authKey,
          userId: (auth as { userId?: string | null }).userId ?? '',
        },
      });
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoginLoading(false);
    }
  }

  const stremioLogoUrl = resolveLogoUrl('services/stremio.svg');
  const traktLogoUrl = resolveLogoUrl('services/trakt.png');
  const simklLogoUrl = resolveLogoUrl('services/simkl.svg');

  const stremioConnected = isNuvio ? !!watchly.nuvioStremioLogin : !!stremioAccount.authKey;

  const cardBase: CSSProperties = {
    padding: '1.1rem', borderRadius: '12px', textAlign: 'left',
    transition: 'all 0.15s', width: '100%',
  };

  return (
    <WizardShell>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>
          🤖 Watchly
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          Watchly analyses your watch history to serve up personalised recommendations
          and dynamic catalogs, like a smart "For You" row that actually knows your taste.
          It is optional and free to skip.
        </p>
      </div>

      {/* Master toggle */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.85rem 1rem', borderRadius: '10px',
          border: `1px solid ${watchly.enabled ? 'var(--accent)' : 'var(--border)'}`,
          background: watchly.enabled ? 'rgba(99,102,241,0.06)' : 'var(--panel)',
          marginBottom: '1rem', cursor: 'pointer',
        }}
        onClick={() => { setWatchly({ enabled: !watchly.enabled }); setLoginError(''); }}
        role="checkbox"
        aria-checked={watchly.enabled}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setWatchly({ enabled: !watchly.enabled }); }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
          Install Watchly
        </span>
        <span style={{
          width: '40px', height: '22px', borderRadius: '11px',
          background: watchly.enabled ? 'var(--accent)' : 'var(--border)',
          position: 'relative', transition: 'background 0.15s', flexShrink: 0,
        }}>
          <span style={{
            position: 'absolute', top: '3px',
            left: watchly.enabled ? '21px' : '3px',
            width: '16px', height: '16px', borderRadius: '50%',
            background: '#fff', transition: 'left 0.15s',
          }} />
        </span>
      </div>

      {watchly.enabled && (
        <>
          {/* Account cards */}
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
            Watch history source
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>

            {/* Stremio card */}
            <div style={{
              ...cardBase,
              border: `2px solid ${stremioConnected ? 'var(--accent)' : 'var(--border)'}`,
              background: stremioConnected ? 'color-mix(in srgb, var(--panel-2) 85%, var(--accent) 15%)' : 'var(--panel)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: stremioConnected || (!isNuvio) ? '0.5rem' : '0.75rem' }}>
                {stremioLogoUrl && (
                  <img src={stremioLogoUrl} alt="Stremio" style={{ height: '24px', width: '24px', objectFit: 'contain', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Stremio</span>
                    {stremioConnected && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', background: 'color-mix(in srgb, var(--panel-2) 60%, var(--accent) 40%)', padding: '0.1rem 0.45rem', borderRadius: '10px' }}>
                        ✓ Connected
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.15rem' }}>
                    {stremioConnected
                      ? (isNuvio ? watchly.nuvioStremioLogin!.email : stremioAccount.email)
                      : 'Required so Watchly can store and retrieve your configuration.'}
                  </div>
                </div>
              </div>

              {/* Nuvio login form (only shown when not yet logged in) */}
              {isNuvio && !watchly.nuvioStremioLogin && (
                <>
                  <label style={{ display: 'block', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Email</span>
                    <input
                      type="email" value={loginEmail}
                      onChange={e => { setLoginEmail(e.target.value); setLoginError(''); }}
                      placeholder="you@example.com" style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Password</span>
                    <input
                      type="password" value={loginPassword}
                      onChange={e => { setLoginPassword(e.target.value); setLoginError(''); }}
                      placeholder="Enter your password..." style={inputStyle}
                    />
                  </label>
                  {loginError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.5rem 0.65rem', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#dc2626' }}>
                      {loginError}
                    </div>
                  )}
                  <button
                    type="button"
                    className="wizard-primary-btn"
                    onClick={handleNuvioLogin}
                    disabled={loginLoading || !loginEmail.includes('@') || loginPassword.length < 4}
                    style={{ width: '100%', padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                    {loginLoading
                      ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
                      : <><LogIn size={14} /> Sign in to Stremio</>}
                  </button>
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </>
              )}

              {/* Change link when Nuvio is logged in */}
              {isNuvio && watchly.nuvioStremioLogin && (
                <button
                  type="button"
                  onClick={() => { setWatchly({ nuvioStremioLogin: null }); setLoginEmail(''); setLoginPassword(''); }}
                  style={{ fontSize: '0.75rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Use a different account
                </button>
              )}
            </div>

            {/* Trakt card (disabled in v1) */}
            <div style={{
              ...cardBase,
              border: '2px solid var(--border)',
              background: 'var(--panel)',
              opacity: 0.45,
              cursor: 'not-allowed',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {traktLogoUrl && (
                  <img src={traktLogoUrl} alt="Trakt" style={{ height: '24px', width: '24px', objectFit: 'contain', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Trakt</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '8px' }}>
                      Coming soon
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.15rem' }}>
                    Use your Trakt watch history as the source for recommendations.
                  </div>
                </div>
              </div>
            </div>

            {/* Simkl card (disabled in v1) */}
            <div style={{
              ...cardBase,
              border: '2px solid var(--border)',
              background: 'var(--panel)',
              opacity: 0.45,
              cursor: 'not-allowed',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {simklLogoUrl && (
                  <img src={simklLogoUrl} alt="Simkl" style={{ height: '24px', width: '24px', objectFit: 'contain', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Simkl</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '8px' }}>
                      Coming soon
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.15rem' }}>
                    Use your Simkl watch history as the source for recommendations.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy disclosure */}
          <div className="wizard-notice" style={{ marginBottom: '1rem' }}>
            <div className="wizard-notice__title">🔒 Privacy note</div>
            <div style={{ fontSize: '0.82rem' }}>
              Your Watchly configuration, including your Stremio identity, is sent to the selected
              Watchly instance. Unlike the other add-ons in this wizard, this step is not processed
              locally in your browser.
            </div>
          </div>
        </>
      )}

      <NextButton
        onClick={nextStep}
        disabled={!canContinue}
        label={watchly.enabled ? 'Continue' : 'Skip and continue'}
      />
    </WizardShell>
  );
}
