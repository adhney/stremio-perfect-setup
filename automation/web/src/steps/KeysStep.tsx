import { WizardShell } from '../components/WizardShell';
import { NextButton } from '../components/NextButton';
import { useWizard } from '../store/wizard';
import { DEBRID_SERVICES } from '../lib/services';
import { RPDB_FREE_KEY } from '../lib/constants';

interface KeyScreen {
  id: string;
  title: string;
  subtitle: string;
  instruction: string;
  placeholder: string;
  optional?: boolean;
  isDebridPicker?: boolean;
}

const KEY_SCREENS: KeyScreen[] = [
  {
    id: 'debrid',
    title: 'Debrid service (optional)',
    subtitle: 'A Debrid service gives you fast, reliable, cached streams. Recommended: TorBox.',
    instruction: 'Pick your Debrid service below and paste your API key. Skip if you want P2P-only (free, but slower).',
    placeholder: 'API key…',
    optional: true,
    isDebridPicker: true,
  },
  {
    id: 'tmdb',
    title: '🎬 TMDB API Keys',
    subtitle: 'Used by AIOMetadata for metadata, posters, and catalogs.',
    instruction: 'Go to themoviedb.org → Settings → API. Copy both the short "API Key" and the long "API Read Access Token".',
    placeholder: 'Paste TMDB API Key here…',
  },
  {
    id: 'tvdb',
    title: '📺 TVDB API Key',
    subtitle: 'Used for TV series metadata and episode data.',
    instruction: 'Go to thetvdb.com → Dashboard → API Keys → create one. Paste it below.',
    placeholder: 'Paste TVDB API Key…',
    optional: true,
  },
  {
    id: 'gemini',
    title: '✨ Gemini API Key (optional)',
    subtitle: 'Enables AI-powered descriptions in AIOMetadata. Completely optional.',
    instruction: 'Go to aistudio.google.com → Get API Key. Skip if you don\'t need AI descriptions.',
    placeholder: 'Paste Gemini API Key (or skip)…',
    optional: true,
  },
  {
    id: 'rpdb',
    title: '⭐ RPDB Poster Ratings',
    subtitle: 'Adds rating overlays to your posters.',
    instruction: 'The free key is pre-filled — no sign-up needed! You can upgrade later at ratingposterdb.com.',
    placeholder: RPDB_FREE_KEY,
    optional: true,
  },
];

interface Props { keyIndex: number; }

export function KeysStep({ keyIndex }: Props) {
  const screen = KEY_SCREENS[keyIndex];
  const { credentials, setCredentials, nextStep } = useWizard();

  if (!screen) { nextStep(); return null; }

  const isDebrid = screen.isDebridPicker;

  return (
    <WizardShell>
      <h2 className="text-xl font-bold mb-1">{screen.title}</h2>
      <p className="text-gray-500 text-sm mb-4 leading-relaxed">{screen.subtitle}</p>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4 text-sm text-purple-800">
        📋 {screen.instruction}
      </div>

      {isDebrid ? (
        <>
          <p className="text-sm font-medium text-gray-700 mb-2">Choose your service:</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {DEBRID_SERVICES.map(s => (
              <button
                key={s.id}
                onClick={() => setCredentials({ debridService: credentials.debridService === s.id ? '' : s.id })}
                className={`p-2 border-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                  credentials.debridService === s.id ? 'border-accent bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {s.logo ? (
                  <img src={s.logo} alt={s.name} className="h-6 w-auto object-contain" />
                ) : (
                  <span className="text-base">📦</span>
                )}
                <span className="text-xs font-medium text-center">{s.name}</span>
              </button>
            ))}
          </div>
          {credentials.debridService && (
            <input
              type="password"
              value={credentials.debridApiKey}
              onChange={e => setCredentials({ debridApiKey: e.target.value })}
              placeholder={`${DEBRID_SERVICES.find(s => s.id === credentials.debridService)?.name} API key…`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          )}
        </>
      ) : screen.id === 'tmdb' ? (
        <>
          <label className="block mb-3">
            <span className="text-sm font-medium text-gray-700">TMDB API Key <span className="text-gray-400">(short)</span></span>
            <input
              type="password"
              value={credentials.tmdbApiKey}
              onChange={e => setCredentials({ tmdbApiKey: e.target.value })}
              placeholder="API Key"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <label className="block mb-1">
            <span className="text-sm font-medium text-gray-700">API Read Access Token <span className="text-gray-400">(long)</span></span>
            <input
              type="password"
              value={credentials.tmdbAccessToken}
              onChange={e => setCredentials({ tmdbAccessToken: e.target.value })}
              placeholder="eyJh…"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
        </>
      ) : (
        <input
          type={screen.id === 'rpdb' ? 'text' : 'password'}
          value={
            screen.id === 'tvdb' ? credentials.tvdbApiKey :
            screen.id === 'gemini' ? credentials.geminiApiKey :
            credentials.rpdbApiKey
          }
          defaultValue={screen.id === 'rpdb' ? RPDB_FREE_KEY : undefined}
          onChange={e => {
            if (screen.id === 'tvdb') setCredentials({ tvdbApiKey: e.target.value });
            else if (screen.id === 'gemini') setCredentials({ geminiApiKey: e.target.value });
            else setCredentials({ rpdbApiKey: e.target.value });
          }}
          placeholder={screen.placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      )}

      <NextButton onClick={nextStep} />
      {screen.optional && (
        <button onClick={nextStep} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Skip for now →
        </button>
      )}
    </WizardShell>
  );
}
