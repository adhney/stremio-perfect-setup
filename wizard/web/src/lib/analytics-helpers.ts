export interface AnalyticsFieldLike {
  id: string;
  type?: string;
}

export function shouldTrackAioField(field: AnalyticsFieldLike) {
  return field.type !== 'password';
}

export function formatAioAnalyticsValue(_type: string | undefined, value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    return joinWithinLimit(value.map((entry) => String(entry)));
  }

  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value;

  const stringValue = String(value ?? '').trim();
  if (!stringValue) return undefined;
  return stringValue;
}

export function toAioAnalyticsParamName(fieldId: string) {
  return `aio_${fieldId
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()}`;
}

function joinWithinLimit(values: string[], maxLength = 100) {
  const trimmedValues = values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
  if (trimmedValues.length === 0) return '';

  const kept: string[] = [];
  for (const value of trimmedValues) {
    const next = kept.length > 0 ? `${kept.join(',')},${value}` : value;
    if (next.length > maxLength) break;
    kept.push(value);
  }

  if (kept.length > 0) return kept.join(',');
  return trimmedValues[0].slice(0, maxLength);
}
