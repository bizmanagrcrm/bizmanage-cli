import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { snapshotFamilies, validateSnapshotReceipt } from '../dist/services/docs-snapshot-contract.js';

const tenant = '9d24a681-c849-41ae-9a3d-64b4fda79070';
const authority = { alias: 'fictional', tenant_id: tenant,
  endpoint: 'https://fictional.bizmanagecrm.com/' };
const component = { platform_id: 'component-1', content_hash: `sha256:${'a'.repeat(64)}` };
const receipt = () => ({
  schema: 'bizmanage.docs-snapshot.v1', tenant_id: tenant,
  endpoint: 'https://fictional.bizmanagecrm.com/',
  core_build_before: 'core-build-1', core_build_after: 'core-build-1',
  revision_before: 'customization-1', revision_after: 'customization-1',
  collections: snapshotFamilies.map((family) => ({ family, state: 'present', logical_count: 1,
    component_count: 1, components: [component] }))
});

describe('strict documentation snapshot receipt', () => {
  it('accepts complete stable fictional snapshots without the old hash cache', () => {
    assert.deepEqual(validateSnapshotReceipt(receipt(), authority), []);
    const empty = receipt();
    empty.collections[0] = { ...empty.collections[0], state: 'empty', logical_count: 0,
      component_count: 0, components: [] };
    assert.deepEqual(validateSnapshotReceipt(empty, authority), []);
    const notApplicable = receipt();
    notApplicable.collections[0] = { ...notApplicable.collections[0], state: 'not_applicable',
      logical_count: null, component_count: null, components: [] };
    assert.deepEqual(validateSnapshotReceipt(notApplicable, authority), []);
  });

  it('rejects an untrusted alias, tenant, URL or changed revision', () => {
    for (const trusted of [null, { ...authority, alias: '' }, { ...authority, tenant_id: 'bad' },
      { ...authority, endpoint: 'http://fictional.bizmanagecrm.com/' },
      { ...authority, endpoint: 'https://attacker.test/' },
      { ...authority, endpoint: 'not a URL' },
      { ...authority, endpoint: 'https://user:pass@fictional.bizmanagecrm.com/' }]) {
      assert.deepEqual(validateSnapshotReceipt(receipt(), trusted), ['trusted snapshot authority is invalid']);
    }
    for (const change of [{ tenant_id: 'other' }, { endpoint: 'https://other.bizmanagecrm.com/' },
      { endpoint: 'https://fictional.bizmanagecrm.com/path' }, { core_build_before: 'bad build' },
      { endpoint: 'not a URL' },
      { core_build_after: 'core-build-2' }, { revision_before: '' },
      { revision_after: 'customization-2' }, { schema: 'old' }]) {
      assert.ok(validateSnapshotReceipt({ ...receipt(), ...change }, authority)
        .includes('snapshot identity or revision changed'));
    }
    assert.deepEqual(validateSnapshotReceipt(null, authority), ['snapshot receipt fields are invalid']);
    assert.deepEqual(validateSnapshotReceipt({ ...receipt(), secret: 'no' }, authority),
      ['snapshot receipt fields are invalid']);
  });

  it('accounts for every collection, state, count, platform ID and hash', () => {
    const missing = receipt(); missing.collections.pop();
    assert.ok(validateSnapshotReceipt(missing, authority).includes('snapshot collection set is incomplete'));
    const malformed = receipt(); malformed.collections[0] = null;
    assert.ok(validateSnapshotReceipt(malformed, authority).includes('objects: collection contract is invalid'));
    for (const change of [{ family: 'wrong' }, { state: 'unknown' }, { components: null },
      { extra: 'no' },
      { logical_count: -1 }, { component_count: 2 }, { state: 'empty', logical_count: 1 },
      { state: 'present', logical_count: 0 },
      { components: [{ ...component, content_hash: 'bad' }] },
      { components: [{ ...component, platform_id: '' }] },
      { components: [null] },
      { components: [{ ...component, extra: 'no' }] },
      { components: [component, component], component_count: 2 }]) {
      const item = receipt(); item.collections[0] = { ...item.collections[0], ...change };
      assert.ok(validateSnapshotReceipt(item, authority).length > 0);
    }
    for (const state of ['unsupported', 'unavailable']) {
      const item = receipt(); item.collections[0] = { ...item.collections[0], state,
        logical_count: null, component_count: null, components: [] };
      assert.ok(validateSnapshotReceipt(item, authority).includes('objects: collection is not publishable'));
    }
    const falseCount = receipt();
    falseCount.collections[0] = { ...falseCount.collections[0], state: 'not_applicable',
      logical_count: 1, component_count: null, components: [] };
    assert.ok(validateSnapshotReceipt(falseCount, authority)
      .includes('objects: unavailable collection must not claim a count'));
  });
});
