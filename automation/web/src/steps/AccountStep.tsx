import { WizardShell } from '../components/WizardShell';
import { NextButton } from '../components/NextButton';
import { useWizard } from '../store/wizard';

export function AccountStep() {
  const { target, stremioAccount, nuvioAccount, setStremioAccount, setNuvioAccount, nextStep } = useWizard();

  const account = target === 'stremio' ? stremioAccount : nuvioAccount;
  const setAccount = target === 'stremio' ? setStremioAccount : setNuvioAccount;
  const appName = target === 'stremio' ? 'Stremio' : 'Nuvio';

  const valid = account.email.includes('@') && account.password.length >= 8;

  return (
    <WizardShell>
      <h2 className="text-xl font-bold mb-1">Your {appName} account</h2>
      <p className="text-gray-500 text-sm mb-5">
        {account.mode === 'create'
          ? `We'll create your ${appName} account automatically.`
          : `Sign in with your existing ${appName} account.`}
      </p>

      <div className="flex gap-2 mb-5">
        {(['create', 'signin'] as const).map(m => (
          <button
            key={m}
            onClick={() => setAccount({ mode: m })}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              account.mode === m ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m === 'create' ? '✨ Create new' : '🔑 Sign in'}
          </button>
        ))}
      </div>

      <label className="block mb-4">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          type="email"
          value={account.email}
          onChange={e => setAccount({ email: e.target.value })}
          placeholder="you@example.com"
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>

      <label className="block mb-2">
        <span className="text-sm font-medium text-gray-700">Password</span>
        <input
          type="password"
          value={account.password}
          onChange={e => setAccount({ password: e.target.value })}
          placeholder="min. 8 characters"
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>

      <NextButton onClick={nextStep} disabled={!valid} />
    </WizardShell>
  );
}
