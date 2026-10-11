import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ValidationService } from '../dist/services/validation.js';
import { ApiService } from '../dist/services/api.js';
import { PushService } from '../dist/services/push.js';
import { PageMetadataSchema } from '../dist/schemas/project-structure.js';

const config = { instanceUrl: 'https://synthetic.invalid', apiKey: 'synthetic-only' };
const page = { name: 'Testing Page', url: 'testing-page' };

function ownedService(t, service) {
  const services = service instanceof PushService
    ? [service, service.apiService, service.hashCache] : [service];
  t.after(() => services.forEach(owned => owned.serviceLogger.winston.close()));
  return service;
}

async function fixture(t, files) {
  const parent = path.resolve(os.tmpdir());
  const root = await fs.mkdtemp(path.join(parent, 'bizmanage-native-metadata-'));
  t.after(async () => {
    assert(root.startsWith(parent + path.sep));
    assert(path.basename(root).startsWith('bizmanage-native-metadata-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  for (const [relative, data] of Object.entries(files)) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, typeof data === 'string' ? data : JSON.stringify(data));
  }
  return root;
}

function capture(api) {
  const requests = [];
  // Only the HTTP transport is replaced; payload construction stays in the real CLI.
  api.client.post = async (url, payload, options) => {
    requests.push({ url, payload, options });
    return { status: 200, data: { success: true } };
  };
  return requests;
}

for (const [label, extra] of [['omitted', {}], ['null', { type: null }]]) {
  test(`native system field accepts ${label} type without inventing a type in its payload`, async t => {
    const field = { internal_name: 'p_group', system: true, display_name: 'Project Group', ...extra };
    const relative = 'src/objects/projects/fields/p_group.json';
    const root = await fixture(t, { [relative]: field });
    const validator = ownedService(t, new ValidationService());
    const validated = await validator.validateFile(path.join(root, relative));
    assert.deepEqual(validated, { valid: true, errors: [], warnings: [] });
    const service = ownedService(t, new PushService(config));
    const requests = capture(service.apiService);
    const pushed = await service.pushChangedFiles(root);
    assert.equal(pushed.success, true);
    assert.deepEqual(pushed.errors, []);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/restapi/customization/field-by-internal-name');
    assert.deepEqual(requests[0].payload, { table: 'projects', ...field });
  });
}

test('custom fields still require a supplied nonempty string type', async t => {
  const validator = ownedService(t, new ValidationService());
  const root = await fixture(t, {});
  const file = path.join(root, 'src/objects/projects/fields/custom_value.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  for (const system of [undefined, false, 'true']) {
    for (const type of [undefined, null, '', ' ', 7, false, {}, []]) {
      await fs.writeFile(file, JSON.stringify({ internal_name: 'custom_value', system, type }));
      const result = await validator.validateFile(file);
      assert.equal(result.valid, false);
      assert(result.errors.some(error => /Field type is required/.test(error.message)));
    }
  }
  await fs.writeFile(file, JSON.stringify({ internal_name: 'custom_value', type: 'input' }));
  assert.equal((await validator.validateFile(file)).valid, true);
});

test('system overrides reject invalid supplied types and still require internal_name', async t => {
  const validator = ownedService(t, new ValidationService());
  const root = await fixture(t, {});
  const file = path.join(root, 'src/objects/projects/fields/system_value.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  for (const type of ['', ' ', 7, false, {}, []]) {
    await fs.writeFile(file, JSON.stringify({ internal_name: 'system_value', system: true, type }));
    const result = await validator.validateFile(file);
    assert.equal(result.valid, false);
    assert(result.errors.some(error => /Field type is required/.test(error.message)));
  }
  await fs.writeFile(file, JSON.stringify({ system: true }));
  const missingName = await validator.validateFile(file);
  assert.equal(missingName.valid, false);
  assert(missingName.errors.some(error => /Field internal_name is required/.test(error.message)));
});

for (const [label, policy] of [['omitted', undefined], ['null', null], ['empty', ''], ['whitespace', ' \t ']]) {
  test(`page ${label} access policy validates and round-trips unchanged`, async t => {
    const metadata = { ...page, access_policy: policy, render_type: 'standalone' };
    assert.equal(PageMetadataSchema.safeParse(metadata).success, true);
    const root = await fixture(t, {
      'src/pages/testing-page.json': metadata,
      'src/pages/testing-page.html': '<main>Testing Page</main>'
    });
    const validator = ownedService(t, new ValidationService());
    const validated = await validator.validateProject(root);
    assert.equal(validated.valid, true);
    assert.deepEqual(validated.errors, []);
    const service = ownedService(t, new PushService(config));
    const requests = capture(service.apiService);
    const result = await service.pushChangedFiles(root);
    assert.equal(result.success, true);
    assert.deepEqual(result.errors, []);
    assert.equal(requests.length, 1, 'Page pairs must push once');
    assert.equal(requests[0].url, '/restapi/custom-pages/by-url');
    assert.deepEqual(requests[0].payload, { ...page, content: '<main>Testing Page</main>',
      publihsed: true, render_type: 'standalone',
      ...(policy === undefined ? {} : { access_policy: policy }) });
    assert.equal((await service.pushChangedFiles(root)).pushedFiles.length, 0);
  });
}

test('explicit page policies and render settings are preserved', async t => {
  const api = ownedService(t, new ApiService(config));
  for (const policy of ['internal', 'external']) {
    const requests = capture(api);
    const metadata = { ...page, access_policy: policy, render_type: 'standalone',
      publihsed: false, data: { synthetic: true }, version: 3, max_version: 4 };
    await api.pushPage(metadata, '<main>Testing Page</main>');
    assert.deepEqual(requests[0].payload, { ...page, access_policy: policy,
      render_type: 'standalone', publihsed: false, data: { synthetic: true },
      content: '<main>Testing Page</main>' });
  }
});

test('page policies still reject nonstring supplied values', () => {
  for (const access_policy of [false, 7, {}, []]) {
    assert.equal(PageMetadataSchema.safeParse({ ...page, access_policy }).success, false);
  }
});

test('omitted render type stays absent from the page payload', async t => {
  const api = ownedService(t, new ApiService(config));
  const requests = capture(api);
  await api.pushPage({ ...page, access_policy: null }, '<main>Testing Page</main>');
  assert.deepEqual(requests[0].payload, { ...page, access_policy: null,
    content: '<main>Testing Page</main>', publihsed: true });
});

test('compiled CLI validates a native project without HTTP or authentication', async t => {
  const root = await fixture(t, {
    'bizmanage.config.json': { version: '2.1.1',
      instance: { url: config.instanceUrl, alias: 'synthetic' },
      project: { name: 'Testing Native Metadata', createdAt: '2026-10-11T00:00:00.000Z' } },
    'src/objects/projects/fields/p_group.json': { internal_name: 'p_group', system: true },
    'src/pages/testing-page.json': { ...page, access_policy: null },
    'src/pages/testing-page.html': '<main>Testing Page</main>'
  });
  const result = spawnSync(process.execPath,
    ['bin/index.js', 'validate', '--all', '--path', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('compiled CLI rejects an invalid custom type with the field validation error', async t => {
  const root = await fixture(t, {
    'bizmanage.config.json': { version: '2.1.1',
      instance: { url: config.instanceUrl, alias: 'synthetic' },
      project: { name: 'Testing Invalid Metadata', createdAt: '2026-10-11T00:00:00.000Z' } },
    'src/objects/projects/fields/custom_value.json': { internal_name: 'custom_value', type: 7 }
  });
  const result = spawnSync(process.execPath,
    ['bin/index.js', 'validate', '--all', '--path', root], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Field type is required/);
});
