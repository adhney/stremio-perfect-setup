import { useState, type CSSProperties } from 'react';
import { Check, Loader2, LogIn } from 'lucide-react';
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

  const [selectedAccount, setSelectedAccount] = useState<'stremio' | 'trakt' | 'simkl' | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState(watchly.nuvioStremioLogin?.email ?? '');
  const [loginPassword, setLoginPassword] = useState(watchly.nuvioStremioLogin?.password ?? '');
  const [loginError, setLoginError] = useState('');

  const isNuvio = target === 'nuvio';
  const stremioConnected = isNuvio ? !!watchly.nuvioStremioLogin : !!stremioAccount.authKey;
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
  const traktLogoUrl  = resolveLogoUrl('services/trakt.png');
  const simklLogoUrl  = resolveLogoUrl('services/simkl.svg');

  return (
    <WizardShell onSubmit={canContinue ? nextStep : undefined}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>
          🤖 Watchly
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 auto', maxWidth: '44rem' }}>
          Watchly is a full-blown recommendations addon that provides real Netflix-like suggestions, and multiple dynamic catalogs depending on what you watch and like. It's optional and free to skip.
        </p>
      </div>

      {/* Master toggle */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.85rem 1rem', borderRadius: '10px',
          border: `1px solid ${watchly.enabled ? 'var(--accent)' : 'var(--border)'}`,
          background: watchly.enabled ? 'rgba(99,102,241,0.06)' : 'var(--panel)',
          marginBottom: isNuvio ? '0.5rem' : '1rem',
          cursor: isNuvio ? 'default' : 'pointer',
          opacity: isNuvio ? 0.6 : 1,
        }}
        onClick={() => { if (!isNuvio) { setWatchly({ enabled: !watchly.enabled }); setLoginError(''); } }}
        role="checkbox"
        aria-checked={watchly.enabled}
        aria-disabled={isNuvio}
        tabIndex={isNuvio ? -1 : 0}
        onKeyDown={(e) => { if (!isNuvio && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); setWatchly({ enabled: !watchly.enabled }); } }}
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

      {isNuvio && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.5rem 0.75rem',
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: 'var(--muted)',
          textAlign: 'center',
        }}>
          Watchly for Nuvio is coming soon.
        </div>
      )}

      {watchly.enabled && !isNuvio && (
        <>
          {/* Account cards — 3-column grid matching Welcome page style */}
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
            Watch history source
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>

            {/* Stremio */}
            <button
              type="button"
              className={`wizard-hover-lift${stremioConnected ? '' : ' wizard-hover-lift--guide'}`}
              onClick={() => {
                if (isNuvio) {
                  if (stremioConnected) {
                    setWatchly({ nuvioStremioLogin: null });
                    setLoginEmail('');
                    setLoginPassword('');
                  }
                  setSelectedAccount('stremio');
                }
              }}
              style={{
                '--wizard-hover-selected-bg': 'var(--panel-2)',
                '--wizard-hover-selected-border': 'var(--accent)',
                '--wizard-hover-selected-color': 'var(--text)',
                padding: '1.1rem',
                border: `2px solid ${stremioConnected || (isNuvio && selectedAccount === 'stremio') ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '12px',
                background: stremioConnected || (isNuvio && selectedAccount === 'stremio') ? 'var(--panel-2)' : 'var(--panel)',
                textAlign: 'center', cursor: isNuvio ? 'pointer' : 'default',
                transition: 'all 0.15s',
              } as CSSProperties}
            >
              {stremioLogoUrl ? (
                <img src={stremioLogoUrl} alt="Stremio" style={{ height: '28px', maxWidth: '100px', objectFit: 'contain', margin: '0 auto 0.75rem', display: 'block' }} />
              ) : (
                <div style={{ height: '28px', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Stremio</div>
              )}
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Stremio</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                {stremioConnected
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(167,243,208,1)', background: 'rgba(167,243,208,0.12)', padding: '0.15rem 0.5rem', borderRadius: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <Check size={11} />
                      {isNuvio ? watchly.nuvioStremioLogin!.email : stremioAccount.email}
                    </span>
                  : 'Sign in to connect your watch history.'}
              </div>
            </button>

            {/* Trakt (coming soon) */}
            <div
              onClick={() => isNuvio && setSelectedAccount('trakt')}
              style={{
                padding: '1.1rem', borderRadius: '12px', textAlign: 'center',
                border: `2px solid ${isNuvio && selectedAccount === 'trakt' ? 'var(--border)' : 'var(--border)'}`,
                background: 'var(--panel)',
                opacity: 0.45, cursor: isNuvio ? 'pointer' : 'not-allowed',
              }}
            >
              {traktLogoUrl ? (
                <img src={traktLogoUrl} alt="Trakt" style={{ height: '28px', maxWidth: '100px', objectFit: 'contain', margin: '0 auto 0.75rem', display: 'block' }} />
              ) : (
                <div style={{ height: '28px', fontWeight: 800, fontSize: '1.1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Trakt</div>
              )}
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Trakt</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.4 }}>Coming soon</div>
            </div>

            {/* Simkl (coming soon) */}
            <div
              onClick={() => isNuvio && setSelectedAccount('simkl')}
              style={{
                padding: '1.1rem', borderRadius: '12px', textAlign: 'center',
                border: '2px solid var(--border)', background: 'var(--panel)',
                opacity: 0.45, cursor: isNuvio ? 'pointer' : 'not-allowed',
              }}
            >
              {simklLogoUrl ? (
                <img src={simklLogoUrl} alt="Simkl" style={{ height: '28px', maxWidth: '100px', objectFit: 'contain', margin: '0 auto 0.75rem', display: 'block' }} />
              ) : (
                <div style={{ height: '28px', fontWeight: 800, fontSize: '1.1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Simkl</div>
              )}
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Simkl</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.4 }}>Coming soon</div>
            </div>
          </div>

          {/* Auth panels — shown when a card is selected */}
          {isNuvio && selectedAccount === 'stremio' && !watchly.nuvioStremioLogin && (
            <div style={{
              background: 'var(--panel-2)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '1rem',
            }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem', marginTop: 0 }}>
                Watchly currently requires a Stremio account to be configured. 
                You can sign in to your Stremio account so it can store your configuration. 
                This account is only used as an identity and is not modified.
              </p>
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
            </div>
          )}

          {isNuvio && selectedAccount === 'trakt' && (
            <div style={{
              background: 'var(--panel-2)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '1rem',
              opacity: 0.6,
            }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>
                Trakt integration is coming soon. You'll be able to connect your Trakt account to use your watch history as a recommendations source.
              </p>
            </div>
          )}

          {isNuvio && selectedAccount === 'simkl' && (
            <div style={{
              background: 'var(--panel-2)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '1rem',
              opacity: 0.6,
            }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>
                Simkl integration is coming soon. You'll be able to connect your Simkl account to use your watch history as a recommendations source.
              </p>
            </div>
          )}
        </>
      )}

      <NextButton
        onClick={nextStep}
        disabled={!canContinue}
        label="Make Magic Happen"
        icon={(
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 4V2" />
            <path d="M15 10V8" />
            <path d="M19 6h2" />
            <path d="M9 6H7" />
            <path d="m18 3 1 1" />
            <path d="m11 10 1 1" />
            <path d="m18 9-1-1" />
            <path d="m11 2 1 1" />
            <path d="m14 7-9 9 2 2 9-9-2-2Z" />
          </svg>
        )}
      />
    </WizardShell>
  );
}
