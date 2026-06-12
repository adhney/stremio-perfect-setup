import type { DebridServiceSelection } from '../store/wizard';

export const INSTANT_DEBRID_SERVICE_IDS = ['torbox', 'premiumize'] as const;
export type InstantDebridServiceId = typeof INSTANT_DEBRID_SERVICE_IDS[number];

export function buildInstantDebridSettingsPatch(
  debridServices: DebridServiceSelection[],
): Record<string, unknown> | null {
  const qualifying = debridServices.filter((d) =>
    (INSTANT_DEBRID_SERVICE_IDS as readonly string[]).includes(d.id),
  );

  const withKeys = qualifying.filter((d) => (d.credentials?.['apiKey'] ?? '').trim());

  if (withKeys.length === 0) return null;

  const debridSettingsPatch: Record<string, unknown> = {
    debrid_enabled: { type: 'boolean', value: true },
    preferred_resolver_provider_id: { type: 'string', value: withKeys[0].id },
  };

  for (const service of withKeys) {
    const apiKey = (service.credentials?.['apiKey'] ?? '').trim();
    debridSettingsPatch[`${service.id}_api_key`] = { type: 'string', value: apiKey };
  }

  const platformPatch = { features: { debrid_settings: debridSettingsPatch } };
  return { tv: platformPatch, mobile: platformPatch };
}
