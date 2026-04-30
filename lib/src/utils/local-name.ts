const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
]);

export function normalizeLocalName(name: string | undefined | null): string {
  if (!name) {
    return 'unnamed';
  }

  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.\s-]+$/g, '');

  if (!normalized) {
    return 'unnamed';
  }

  if (WINDOWS_RESERVED_NAMES.has(normalized)) {
    return `${normalized}-item`;
  }

  return normalized;
}