#!/usr/bin/env node
/**
 * Interactive Nuvio Perfect Setup CLI — no browser, no CORS proxy needed.
 *
 * Usage:
 *   node scripts/nuvio-setup-cli.mjs --token "eyJ..."
 *   NUVIO_TOKEN="eyJ..." node scripts/nuvio-setup-cli.mjs
 *   node scripts/nuvio-setup-cli.mjs   # prompts for token
 *
 * Options:
 *   --token <jwt>       Nuvio access_token from nuvio.tv localStorage
 *   --config <name>     Config block in wizard/config.json (default: main)
 *   --yes, -y           Accept defaults for catalogs & AIOStreams options
 *   --torbox-key <key>  Configure TorBox debrid (skips debrid prompts)
 *   --profile <name>    Profile name or number (default: first profile)
 *   --dry-run           Load config and print plan only
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { runNuvioSetup } from '../wizard/core/orchestrator.js';
import {
  createNuvioAdapter,
  getEmailFromNuvioToken,
  parseNuvioBrowserSession,
} from '../wizard/core/adapters/nuvio.js';
import {
  defaultEnabledCategories,
  deriveCategories,
  deriveDiscoverFolders,
  normalizeCategoryOrder,
  normalizeDiscoverFolderOrder,
} from '../wizard/core/catalog-config.js';

function buildInstantDebridSettingsPatch(debridServices) {
  const qualifying = debridServices.filter((d) => ['torbox', 'premiumize'].includes(d.id));
  const withKeys = qualifying.filter((d) => String(d.credentials?.apiKey ?? '').trim());
  if (!withKeys.length) return null;
  const debridSettingsPatch = {
    debrid_enabled: { type: 'boolean', value: true },
    preferred_resolver_provider_id: { type: 'string', value: withKeys[0].id },
  };
  for (const service of withKeys) {
    debridSettingsPatch[`${service.id}_api_key`] = {
      type: 'string',
      value: String(service.credentials.apiKey).trim(),
    };
  }
  const platformPatch = { features: { debrid_settings: debridSettingsPatch } };
  return { tv: platformPatch, mobile: platformPatch };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'wizard', 'config.json');

const DEBRID_SERVICES = [
  { id: 'torbox', name: 'TorBox', fields: ['apiKey'] },
  { id: 'realdebrid', name: 'Real-Debrid', fields: ['apiKey'] },
  { id: 'alldebrid', name: 'AllDebrid', fields: ['apiKey'] },
  { id: 'debridlink', name: 'Debrid-Link', fields: ['apiKey'] },
  { id: 'premiumize', name: 'Premiumize', fields: ['apiKey'] },
  { id: 'easydebrid', name: 'EasyDebrid', fields: ['apiKey'] },
  { id: 'debrider', name: 'Debrider', fields: ['apiKey'] },
  { id: 'pikpak', name: 'PikPak', fields: ['email', 'password'] },
  { id: 'offcloud', name: 'Offcloud', fields: ['apiKey', 'email', 'password'] },
  { id: 'seedr', name: 'Seedr', fields: ['apiKey'] },
  { id: 'putio', name: 'Put.io', fields: ['clientId', 'token'] },
];

const STEP_LABELS = {
  account: 'Account ready',
  backup: 'Existing addons backed up',
  profile: 'Profile loaded',
  aiostreams: 'AIOStreams configuration saved',
  aiometadata: 'AIOMetadata configuration saved',
  addons: 'Addons installed',
  collections: 'Collections installed',
  settings: 'Settings updated',
};

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    token: process.env.NUVIO_TOKEN ?? '',
    config: 'main',
    yes: false,
    dryRun: false,
    torboxKey: process.env.TORBOX_API_KEY ?? '',
    profile: process.env.NUVIO_PROFILE ?? '',
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') opts.yes = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--token') opts.token = argv[++i] ?? '';
    else if (arg === '--torbox-key') opts.torboxKey = argv[++i] ?? '';
    else if (arg === '--profile') opts.profile = argv[++i] ?? '';
    else if (arg === '--config') opts.config = argv[++i] ?? 'main';
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 14).join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));
  const close = () => rl.close();
  return { ask, close };
}

function logStep(name, detail = '') {
  const label = STEP_LABELS[name] ?? name;
  console.log(`\n✓ ${label}${detail ? `: ${detail}` : ''}`);
}

function logInfo(msg) {
  console.log(`  · ${msg}`);
}

function logWarn(msg) {
  console.warn(`  ⚠ ${msg}`);
}

function heading(title) {
  console.log(`\n━━ ${title} ━━`);
}

function randomPassword(len = 20) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(len), (b) => chars[b % chars.length]).join('');
}

// ---------------------------------------------------------------------------
// Config + keys (mirrors wizard sharedKeys.ts)
// ---------------------------------------------------------------------------

function loadWizardConfig(blockName) {
  const file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const block = file.configurations?.find((c) => c.name === blockName);
  if (!block) throw new Error(`No config block "${blockName}" in wizard/config.json`);
  return block;
}

function decryptKey(encoded, passphrase) {
  const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const salt = Buffer.from(payload.s, 'base64');
  const iv = Buffer.from(payload.n, 'base64');
  const iterations = payload.i ?? 250000;
  const ciphertext = Buffer.from(payload.c, 'base64');
  const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
  const encrypted = ciphertext.subarray(0, -16);
  const tag = ciphertext.subarray(-16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8').trim();
}

function pickRandom(values) {
  if (!values.length) return '';
  return values[crypto.randomInt(values.length)];
}

function resolveSharedKeys(config) {
  const passphrase = config.name;
  const decryptArray = (arr) => (arr ?? []).map((s) => decryptKey(s, passphrase)).filter(Boolean);
  return {
    tmdbApiKey: pickRandom(decryptArray(config.keys.tmdbApiKeys)),
    tmdbAccessToken: pickRandom(decryptArray(config.keys.tmdbReadAccessTokens)),
    tvdbApiKey: pickRandom(decryptArray(config.keys.tvdbApiKeys)),
    geminiApiKey: pickRandom(decryptArray(config.keys.geminiApiKeys)),
    rpdbApiKey: pickRandom(decryptArray(config.keys.rpdbApiKeys)),
  };
}

function loadJson(relativePath) {
  const full = path.join(ROOT, relativePath.replace(/^\.\.\//, ''));
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

// ---------------------------------------------------------------------------
// AIOStreams defaults
// ---------------------------------------------------------------------------

function setNested(obj, id, value) {
  const parts = id.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = structuredClone(value);
}

function buildDefaultAioInputs(template) {
  const inputs = {};
  for (const field of template?.metadata?.inputs ?? []) {
    if (field.id && field.default !== undefined) setNested(inputs, field.id, field.default);
    for (const sub of field.subOptions ?? []) {
      if (sub.id && sub.default !== undefined) setNested(inputs, sub.id, sub.default);
    }
  }
  return inputs;
}

function listAioSections(template) {
  return (template?.metadata?.inputs ?? [])
    .filter((f) => f.id?.startsWith('header.') && String(f.name ?? '').trim())
    .map((f) => ({ id: f.id, title: String(f.name).replace(/^[\p{Emoji}\s]+/u, '').trim() }));
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

async function promptToken(ask, initial) {
  let raw = String(initial ?? '').trim();
  if (!raw) {
    heading('Nuvio sign-in');
    console.log('Paste your access_token from nuvio.tv → DevTools → Application → Local Storage');
    console.log('Or run in browser console: copy(localStorage.getItem("access_token"))\n');
    raw = (await ask('Nuvio token: ')).trim();
  }
  return parseNuvioBrowserSession(raw);
}

async function promptProfile(ask, adapter, token, preferred = '') {
  heading('Profile');
  const profiles = await adapter.getProfiles(token);
  if (!profiles.length) throw new Error('No Nuvio profiles found on this account.');

  profiles.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (profile ${p.profile_index})`);
  });

  let profile = profiles[0];
  const pref = String(preferred ?? '').trim();
  if (pref) {
    const byIndex = Number(pref);
    if (Number.isFinite(byIndex) && byIndex >= 1 && byIndex <= profiles.length) {
      profile = profiles[byIndex - 1];
    } else {
      const byName = profiles.find((p) => p.name.toLowerCase() === pref.toLowerCase());
      if (!byName) throw new Error(`Profile "${pref}" not found.`);
      profile = byName;
    }
  } else if (profiles.length > 1) {
    const answer = (await ask(`\nSelect profile [1-${profiles.length}] (default 1): `)).trim();
    const idx = answer ? Number(answer) - 1 : 0;
    if (!Number.isFinite(idx) || idx < 0 || idx >= profiles.length) {
      throw new Error('Invalid profile selection.');
    }
    profile = profiles[idx];
  }

  logInfo(`Using profile: ${profile.name} (#${profile.profile_index})`);
  return profile;
}

async function promptDebridServices(ask, torboxKey = '') {
  if (torboxKey.trim()) {
    heading('Debrid services');
    logInfo('TorBox configured from --torbox-key');
    return [{ id: 'torbox', credentials: { apiKey: torboxKey.trim() } }];
  }

  heading('Debrid services (optional)');
  console.log('Pick debrid providers for AIOStreams. Enter numbers comma-separated, or press Enter to skip.\n');
  DEBRID_SERVICES.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));

  const answer = (await ask('\nYour selection (e.g. 1,2): ')).trim();
  if (!answer) return [];

  const picks = answer.split(/[,\s]+/).map((v) => Number(v) - 1).filter((n) => Number.isFinite(n));
  const selected = [...new Set(picks)].map((i) => DEBRID_SERVICES[i]).filter(Boolean);
  const result = [];

  for (const service of selected) {
    const credentials = {};
    for (const field of service.fields) {
      const value = (await ask(`  ${service.name} — ${field}: `)).trim();
      if (!value) throw new Error(`${service.name} requires ${field}.`);
      credentials[field] = value;
    }
    result.push({ id: service.id, credentials });
    logInfo(`${service.name} configured`);
  }

  return result;
}

async function promptApiKeys(ask, shared, autoYes) {
  heading('API keys');
  console.log('Press Enter to use built-in shared keys from config.json where available.\n');

  const askKey = async (label, sharedValue, required = true) => {
    if (autoYes) {
      if (sharedValue) {
        logInfo(`${label}: using shared key`);
        return sharedValue;
      }
      if (!required) {
        logInfo(`${label}: skipped`);
        return '';
      }
    }
    const hint = sharedValue ? ' [shared key available]' : '';
    const value = (await ask(`${label}${hint}: `)).trim();
    if (value) return value;
    if (sharedValue) {
      logInfo(`${label}: using shared key`);
      return sharedValue;
    }
    if (required) throw new Error(`${label} is required.`);
    return '';
  };

  return {
    tmdbApiKey: await askKey('TMDB API Key', shared.tmdbApiKey),
    tmdbAccessToken: await askKey('TMDB Read Access Token', shared.tmdbAccessToken),
    tvdbApiKey: await askKey('TVDB API Key', shared.tvdbApiKey),
    geminiApiKey: await askKey('Gemini API Key (optional)', shared.geminiApiKey, false),
    rpdbApiKey: await askKey('RPDB API Key (optional)', shared.rpdbApiKey, false),
  };
}

async function promptInstantDebrid(ask, debridServices, autoYes) {
  const qualifying = debridServices.filter((d) => ['torbox', 'premiumize'].includes(d.id) && d.credentials.apiKey);
  if (!qualifying.length) return false;

  heading('Instant Debrid (Nuvio)');
  console.log('Routes streams through your debrid account inside Nuvio (skips AIOStreams debrid scrapers).\n');
  if (autoYes) {
    logInfo('Instant Debrid: disabled (default)');
    return false;
  }
  const answer = (await ask('Enable Instant Debrid? [y/N]: ')).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function promptCatalogs(ask, aiometadataTemplate, collections, categoryExceptions, autoYes) {
  heading('Catalogs');
  const catalogs = aiometadataTemplate.config.catalogs;
  const categories = deriveCategories(catalogs, collections, categoryExceptions);
  const discover = deriveDiscoverFolders(catalogs, collections, categoryExceptions);
  const defaults = defaultEnabledCategories(catalogs, 'nuvio', collections, categoryExceptions);

  console.log(`Template has ${categories.length} categories and ${discover.length} discover folders.`);
  console.log(`Recommended defaults: ${defaults.categories.size} categories, ${defaults.discoverFolderIds.size} discover folders.\n`);

  if (!autoYes) {
    const answer = (await ask('Use recommended catalog selection? [Y/n]: ')).trim().toLowerCase();
    if (answer === 'n' || answer === 'no') {
      console.log('Custom catalog picking is not implemented in CLI yet — using recommended defaults.');
    }
  }

  return {
    enabledCategories: defaults.categories,
    enabledDiscoverFolderIds: defaults.discoverFolderIds,
    categoryOrder: normalizeCategoryOrder(
      categories.map((c) => c.key),
      categories.map((c) => c.key),
      'nuvio',
    ),
    discoverFolderOrder: normalizeDiscoverFolderOrder(
      discover.map((d) => d.id),
      discover.map((d) => d.id),
    ),
  };
}

async function promptAddonPassword(ask, autoYes) {
  heading('Addon password');
  console.log('Used to lock your AIOStreams & AIOMetadata configs (can differ from Nuvio login).\n');
  if (autoYes) {
    const generated = randomPassword();
    logInfo('Generated addon password (save this!)');
    return generated;
  }
  const value = (await ask('Addon password (Enter = auto-generate): ')).trim();
  if (value.length >= 6) return value;
  const generated = randomPassword();
  logInfo(`Generated addon password: ${generated}`);
  return generated;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);
  const { ask, close } = createPrompter();

  try {
    const config = loadWizardConfig(opts.config);
    const templates = {
      aiostreams: loadJson(config.templates.nuvio.aiostreams),
      aiometadata: loadJson(config.templates.nuvio.aiometadata),
      collections: loadJson(config.templates.nuvio.collections),
      settings: loadJson(config.templates.nuvio.settings),
    };

    const token = await promptToken(ask, opts.token);
    const adapter = createNuvioAdapter();
    const email = getEmailFromNuvioToken(token) ?? '(unknown)';
    logStep('account', `Signed in as ${email}`);

    const profile = await promptProfile(ask, adapter, token, opts.profile);
    const addonPassword = await promptAddonPassword(ask, opts.yes);
    const shared = resolveSharedKeys(config);
    const credentials = await promptApiKeys(ask, shared, opts.yes || Boolean(opts.torboxKey));
    const debridServices = await promptDebridServices(ask, opts.torboxKey);
    const instantDebrid = await promptInstantDebrid(ask, debridServices, opts.yes || Boolean(opts.torboxKey));
    const aioStreamsInputs = buildDefaultAioInputs(templates.aiostreams);

    const useDefaults = opts.yes || Boolean(opts.torboxKey);
    if (!useDefaults) {
      const sections = listAioSections(templates.aiostreams);
      console.log(`\nAIOStreams: using template defaults (${sections.length} sections).`);
      const custom = (await ask('Customize AIOStreams options interactively? [y/N]: ')).trim().toLowerCase();
      if (custom === 'y' || custom === 'yes') {
        console.log('Full AIOStreams UI is not ported to CLI yet — edit templates/AIOStreams.json defaults or use the web wizard for fine-tuning.');
      }
    } else {
      logInfo(`AIOStreams: template defaults (${listAioSections(templates.aiostreams).length} sections)`);
    }

    const catalogSelection = await promptCatalogs(
      ask,
      templates.aiometadata,
      templates.collections,
      config.catalogSelectionExceptions ?? [],
      useDefaults,
    );

    const aiometadataParams = {
      baseTemplate: templates.aiometadata,
      enabledCategories: catalogSelection.enabledCategories,
      enabledDiscoverFolderIds: catalogSelection.enabledDiscoverFolderIds,
      categoryOrder: catalogSelection.categoryOrder,
      discoverFolderOrder: catalogSelection.discoverFolderOrder,
      categoryExceptions: config.catalogSelectionExceptions ?? [],
      apiKeys: {
        tmdb: credentials.tmdbApiKey,
        tmdbAccess: credentials.tmdbAccessToken,
        tvdb: credentials.tvdbApiKey,
        gemini: credentials.geminiApiKey,
        rpdb: credentials.rpdbApiKey,
      },
      language: templates.aiometadata?.config?.language ?? 'en-US',
    };

    const aiostreamsParams = {
      template: templates.aiostreams,
      inputs: aioStreamsInputs,
      services: instantDebrid ? [] : debridServices.map((d) => d.id),
      credentials: {
        tmdbApiKey: credentials.tmdbApiKey,
        tmdbAccessToken: credentials.tmdbAccessToken,
        tvdbApiKey: credentials.tvdbApiKey,
        geminiApiKey: credentials.geminiApiKey,
        rpdbApiKey: credentials.rpdbApiKey,
      },
      serviceCredentials: instantDebrid
        ? {}
        : Object.fromEntries(
            debridServices.map((s) => [s.id, s.credentials]),
          ),
    };

    let nuvioSettingsTemplate = templates.settings;
    if (instantDebrid) {
      const patch = buildInstantDebridSettingsPatch(debridServices);
      if (patch) {
        nuvioSettingsTemplate = {
          ...templates.settings,
          tv: { ...templates.settings?.tv, features: { ...templates.settings?.tv?.features, ...patch.tv?.features } },
          mobile: { ...templates.settings?.mobile, features: { ...templates.settings?.mobile?.features, ...patch.mobile?.features } },
        };
      }
    }

    if (opts.dryRun) {
      heading('Dry run — plan only');
      console.log(JSON.stringify({
        email,
        profile: profile.name,
        debridServices: debridServices.map((d) => d.id),
        instantDebrid,
        instances: config.instances,
      }, null, 2));
      return;
    }

    heading('Installing');
    console.log('Running setup (no CORS proxy needed from CLI)…\n');

    const result = await runNuvioSetup({
      instances: config.instances,
      account: {
        mode: 'signin',
        email,
        password: addonPassword,
        authToken: token,
        profileId: profile.profile_index,
      },
      aiostreamsParams,
      aiometadataParams,
      watchlyBody: null,
      collectionsJson: templates.collections,
      nuvioSettingsTemplate,
      proxyBase: '', // Node.js — direct API calls, no browser CORS
      onStep: (name, data) => {
        if (name === 'backup') {
          logStep(name, `${data?.count ?? 0} addons backed up`);
        } else if (name === 'profile') {
          logStep(name, `${data?.profileName ?? ''} (#${data?.profileIndex ?? ''})`);
        } else if (name === 'aiostreams' || name === 'aiometadata') {
          logStep(name, data?.instance ?? '');
        } else if (name === 'addons') {
          logStep(name, `${data?.count ?? 0} addons → profile ${data?.profileName ?? data?.profileIndex ?? ''}`);
        } else if (name === 'collections') {
          logStep(name, `${data?.groupCount ?? 0} groups`);
        } else if (name === 'settings') {
          const platforms = data?.appliedPlatforms?.join(', ') ?? '';
          logStep(name, platforms ? `Applied: ${platforms}` : 'Done');
        } else {
          logStep(name);
        }
      },
    });

    if (result.warnings?.length) {
      heading('Warnings');
      for (const w of result.warnings) logWarn(w);
    }

    heading('Done — save these');
    console.log(`Addon password: ${result.addonPasswordSource === 'generated' ? '(generated at start)' : addonPassword}`);
    if (result.addons.aiostreams) {
      console.log(`\nAIOStreams manifest:\n  ${result.addons.aiostreams.manifestUrl}`);
      console.log(`AIOStreams config: ${result.addons.aiostreams.instance}`);
    }
    if (result.addons.aiometadata) {
      console.log(`\nAIOMetadata manifest:\n  ${result.addons.aiometadata.manifestUrl}`);
    }

    const outPath = path.join(ROOT, `perfect-setup-${profile.profile_index}-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`\nFull result saved to: ${outPath}`);
  } finally {
    close();
  }
}

main().catch((err) => {
  console.error(`\n✕ Setup failed: ${err?.message || err}`);
  process.exit(1);
});
