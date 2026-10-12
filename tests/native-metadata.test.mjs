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

test('public API declarations accept native metadata without weakening custom field types', async t => {
  const root = await fixture(t, {});
  const apiPath = path.relative(root, path.resolve('dist/services/api.js')).replaceAll(path.sep, '/');
  const source = `import type { BizmanageField, BizmanagePageResponse } from ${JSON.stringify(apiPath)};
const nativeOmitted: BizmanageField = { internal_name: 'p_group', system: true };
const nativeNull: BizmanageField = { internal_name: 'contact', system: true, type: null };
const custom: BizmanageField = { name: 'custom', label: 'Custom', type: 'input', system: false };
const legacyCustom: BizmanageField = { name: 'custom', label: 'Custom', type: 'input', extra: 7 };
const page: BizmanagePageResponse = {
  id: 1, name: 'Page', content: '<main>Page</main>', version: 1, publihsed: true, access_policy: null
};
function inspectCustom(field: BizmanageField) {
  if (field.system !== true) {
    const type: string = field.type;
    const name: string = field.name;
    const label: string = field.label;
  }
}
// @ts-expect-error Custom fields still require type.
const missingType: BizmanageField = { name: 'custom', label: 'Custom' };
// @ts-expect-error Custom field type is not nullable.
const nullType: BizmanageField = { name: 'custom', label: 'Custom', type: null };
// @ts-expect-error Custom field type must be a string.
const numericType: BizmanageField = { name: 'custom', label: 'Custom', type: 7 };
// @ts-expect-error Non-native fields still require name.
const missingName: BizmanageField = { label: 'Custom', type: 'input' };
// @ts-expect-error Non-native fields still require label.
const missingLabel: BizmanageField = { name: 'custom', type: 'input' };
// @ts-expect-error Native fields cannot supply a numeric type.
const invalidNative: BizmanageField = { name: 'native', label: 'Native', system: true, type: 7 };
// @ts-expect-error The index signature must not erase the known name type.
const invalidName: BizmanageField = { name: 7, label: 'Custom', type: 'input' };
`;
  const file = path.join(root, 'public-api-types.mts');
  await fs.writeFile(file, source);
  const compiled = spawnSync(process.execPath, [path.resolve('node_modules/typescript/bin/tsc'),
    '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'Node16',
    '--moduleResolution', 'Node16', file], { encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
});

test('fetched native fields validate and push unchanged without invented type or labels', async t => {
  const api = ownedService(t, new ApiService(config));
  const raw = [
    { id: 1, internal_name: 'p_group', system: true, alias: 'Project Group' },
    { id: 2, internal_name: 'contact', system: true, type: null, alias: 'Primary Contact' }
  ];
  let getCount = 0;
  api.client.get = async url => {
    assert.equal(url, '/restapi/customization/fields/projects?changed_only=true');
    getCount++;
    return { status: 200, data: raw };
  };
  const fields = await api.fetchFields('projects');
  assert.deepEqual(fields, raw.map(({ id, ...field }) => field));
  assert.equal(getCount, 1);
  const root = await fixture(t, Object.fromEntries(fields.map(field =>
    [`src/objects/projects/fields/${field.internal_name}.json`, field])));
  const validator = ownedService(t, new ValidationService());
  const requests = capture(api);
  for (const field of fields) {
    const file = path.join(root, 'src/objects/projects/fields', field.internal_name + '.json');
    assert.equal((await validator.validateFile(file)).valid, true);
    await api.pushFieldDefinition('projects', field);
  }
  assert.deepEqual(requests.map(request => ({ url: request.url, payload: request.payload })),
    fields.map(field => ({ url: '/restapi/customization/field-by-internal-name',
      payload: { table: 'projects', ...field } })));
});

test('fetched null and blank page policies validate and push unchanged', async t => {
  const api = ownedService(t, new ApiService(config));
  const raw = [
    { id: 1, name: 'Null Policy', url: 'null-policy', content: '<main>Null Policy</main>',
      version: 1, publihsed: false, access_policy: null },
    { id: 2, name: 'Blank Policy', url: 'blank-policy', content: '<main>Blank Policy</main>',
      version: 1, publihsed: true, access_policy: '', render_type: 'standalone' }
  ];
  let getCount = 0;
  api.client.get = async url => {
    assert.equal(url, '/restapi/admin/custom-pages/all');
    getCount++;
    return { status: 200, data: raw };
  };
  const pages = await api.fetchPages();
  assert.equal(getCount, 1);
  assert.equal(pages.length, 2);
  const root = await fixture(t, Object.fromEntries(pages.flatMap(page => [
    [`src/pages/${page.name}.json`, page.metadata], [`src/pages/${page.name}.html`, page.html]
  ])));
  const validator = ownedService(t, new ValidationService());
  const requests = capture(api);
  for (const [index, page] of pages.entries()) {
    assert.equal(page.metadata.access_policy, raw[index].access_policy);
    assert.equal(page.html, raw[index].content);
    assert.equal(PageMetadataSchema.safeParse(page.metadata).success, true);
    const file = path.join(root, 'src/pages', page.name + '.json');
    assert.equal((await validator.validateFile(file)).valid, true);
    await api.pushPage(page.metadata, page.html);
  }
  assert.deepEqual(requests.map(request => ({ url: request.url, payload: request.payload })),
    raw.map(page => ({ url: '/restapi/custom-pages/by-url', payload: {
      name: page.name, url: page.url, content: page.content, publihsed: page.publihsed,
      access_policy: page.access_policy,
      ...(page.render_type === undefined ? {} : { render_type: page.render_type })
    } })));
});
