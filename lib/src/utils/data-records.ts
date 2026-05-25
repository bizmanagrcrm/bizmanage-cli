export interface BizmanageDataRecord extends Record<string, unknown> {
  internal_name: string;
}

export const DATA_RECORD_UPSERT_ENDPOINT_PLACEHOLDER = '/restapi/customization/data-by-internal-name';

const FORBIDDEN_DATA_KEY_PATTERN = /(^id$|_id$|^ref$|_ref$)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeRecord(index: number, internalName?: unknown): string {
  return typeof internalName === 'string' && internalName.trim()
    ? `Record "${internalName.trim()}"`
    : `Record #${index + 1}`;
}

function formatPropertyPath(segments: string[]): string {
  return segments.join('.').replace(/\.\[/g, '[');
}

function collectForbiddenKeyErrors(
  value: unknown,
  propertyPath: string[],
  recordLabel: string,
  errors: string[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectForbiddenKeyErrors(entry, [...propertyPath, `[${index}]`], recordLabel, errors);
    });
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = [...propertyPath, key];

    if (FORBIDDEN_DATA_KEY_PATTERN.test(key)) {
      errors.push(`${recordLabel} cannot contain id/ref fields (${formatPropertyPath(nextPath)}).`);
    }

    collectForbiddenKeyErrors(nestedValue, nextPath, recordLabel, errors);
  }
}

export function getDataFileValidationErrors(content: unknown): string[] {
  if (!Array.isArray(content) && !isPlainObject(content)) {
    return ['Data files must contain either a JSON object or an array of JSON objects.'];
  }

  const records = Array.isArray(content) ? content : [content];
  const errors: string[] = [];
  const seenInternalNames = new Set<string>();

  records.forEach((record, index) => {
    if (!isPlainObject(record)) {
      errors.push(`Record #${index + 1} must be a JSON object.`);
      return;
    }

    const recordLabel = describeRecord(index, record.internal_name);
    const internalName = typeof record.internal_name === 'string' ? record.internal_name.trim() : '';

    if (!internalName) {
      errors.push(`${recordLabel} must include a non-empty internal_name.`);
    } else {
      const normalizedInternalName = internalName.toLowerCase();
      if (seenInternalNames.has(normalizedInternalName)) {
        errors.push(`${recordLabel} duplicates internal_name "${internalName}" within the same file.`);
      } else {
        seenInternalNames.add(normalizedInternalName);
      }
    }

    collectForbiddenKeyErrors(record, [], recordLabel, errors);
  });

  return errors;
}

export function parseDataFileRecords(content: unknown, sourceLabel: string): BizmanageDataRecord[] {
  const errors = getDataFileValidationErrors(content);

  if (errors.length > 0) {
    throw new Error(`${sourceLabel}: ${errors.join(' ')}`);
  }

  if (Array.isArray(content)) {
    return content as BizmanageDataRecord[];
  }

  return [content as BizmanageDataRecord];
}
