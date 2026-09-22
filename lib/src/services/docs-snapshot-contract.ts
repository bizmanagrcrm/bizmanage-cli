/** Read-only snapshot receipt validation. Fetching and file materialization are separate. */
export const snapshotFamilies = Object.freeze([
  'objects', 'fields', 'actions', 'reports', 'pages', 'scripts'
] as const);

export interface SnapshotComponent {
  readonly platform_id: string;
  readonly content_hash: string;
}

export interface SnapshotCollection {
  readonly family: typeof snapshotFamilies[number];
  readonly state: 'present' | 'empty' | 'not_applicable' | 'unsupported' | 'unavailable';
  readonly logical_count: number | null;
  readonly component_count: number | null;
  readonly components: readonly SnapshotComponent[];
}

export interface SnapshotReceipt {
  readonly schema: 'bizmanage.docs-snapshot.v1';
  readonly tenant_id: string;
  readonly endpoint: string;
  readonly core_build_before: string;
  readonly core_build_after: string;
  readonly revision_before: string;
  readonly revision_after: string;
  readonly collections: readonly SnapshotCollection[];
}

export interface SnapshotAuthority {
  readonly alias: string;
  readonly tenant_id: string;
  readonly endpoint: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const hash = /^sha256:[0-9a-f]{64}$/;
const fields = ['schema', 'tenant_id', 'endpoint', 'core_build_before', 'core_build_after',
  'revision_before', 'revision_after', 'collections'];
const collectionFields = ['family', 'state', 'logical_count', 'component_count', 'components'];
const componentFields = ['platform_id', 'content_hash'];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function endpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password
      || parsed.pathname !== '/' || parsed.search || parsed.hash
      || !/^[a-z0-9-]+\.bizmanagecrm\.com$/.test(parsed.hostname)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function validateSnapshotReceipt(value: unknown, authority: SnapshotAuthority): readonly string[] {
  if (!authority || !id.test(authority.alias) || !uuid.test(authority.tenant_id)
    || !endpoint(authority.endpoint)) return ['trusted snapshot authority is invalid'];
  if (!object(value) || !exact(value, fields)) return ['snapshot receipt fields are invalid'];
  const errors: string[] = [];
  if (value.schema !== 'bizmanage.docs-snapshot.v1' || value.tenant_id !== authority.tenant_id
    || endpoint(value.endpoint) !== endpoint(authority.endpoint)
    || !id.test(String(value.core_build_before))
    || value.core_build_before !== value.core_build_after
    || !id.test(String(value.revision_before))
    || value.revision_before !== value.revision_after) errors.push('snapshot identity or revision changed');
  if (!Array.isArray(value.collections) || value.collections.length !== snapshotFamilies.length) {
    errors.push('snapshot collection set is incomplete');
    return errors;
  }
  for (const [index, family] of snapshotFamilies.entries()) {
    const input = value.collections[index];
    if (!object(input) || !exact(input, collectionFields) || input.family !== family
      || !['present', 'empty', 'not_applicable', 'unsupported', 'unavailable'].includes(String(input.state))
      || !Array.isArray(input.components)) {
      errors.push(`${family}: collection contract is invalid`);
      continue;
    }
    if (input.state === 'present' || input.state === 'empty') {
      if (!Number.isSafeInteger(input.logical_count) || Number(input.logical_count) < 0
        || !Number.isSafeInteger(input.component_count) || Number(input.component_count) < 0
        || input.components.length !== input.component_count
        || (input.state === 'empty' && (input.logical_count !== 0 || input.component_count !== 0))
        || (input.state === 'present' && (input.logical_count === 0 || input.component_count === 0))) {
        errors.push(`${family}: collection count is invalid`);
      }
    } else if (input.logical_count !== null || input.component_count !== null || input.components.length > 0) {
      errors.push(`${family}: unavailable collection must not claim a count`);
    }
    if (input.state === 'unavailable' || input.state === 'unsupported') {
      errors.push(`${family}: collection is not publishable`);
    }
    const seen = new Set<string>();
    for (const component of input.components) {
      if (!object(component) || !exact(component, componentFields)
        || !id.test(String(component.platform_id)) || !hash.test(String(component.content_hash))
        || seen.has(String(component.platform_id))) errors.push(`${family}: component contract is invalid`);
      else seen.add(String(component.platform_id));
    }
  }
  return errors;
}
