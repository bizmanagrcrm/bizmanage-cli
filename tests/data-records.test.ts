import { getDataFileValidationErrors, parseDataFileRecords } from '../lib/src/utils/data-records.js';

describe('data record helpers', () => {
  it('accepts a single object with internal_name', () => {
    const records = parseDataFileRecords(
      { internal_name: 'new', display_name: 'New' },
      'status.json'
    );

    expect(records).toEqual([
      { internal_name: 'new', display_name: 'New' }
    ]);
  });

  it('accepts an array of objects', () => {
    const records = parseDataFileRecords(
      [
        { internal_name: 'new', display_name: 'New' },
        { internal_name: 'closed', display_name: 'Closed' }
      ],
      'status.json'
    );

    expect(records).toHaveLength(2);
    expect(records[1].internal_name).toBe('closed');
  });

  it('rejects id/ref keys anywhere in the record', () => {
    const errors = getDataFileValidationErrors({
      internal_name: 'new',
      related_ref: 'abc',
      nested: {
        owner_id: 5
      }
    });

    expect(errors).toEqual([
      'Record "new" cannot contain id/ref fields (related_ref).',
      'Record "new" cannot contain id/ref fields (nested.owner_id).'
    ]);
  });

  it('rejects records without internal_name', () => {
    expect(() => parseDataFileRecords({ display_name: 'New' }, 'status.json')).toThrow(
      'status.json: Record #1 must include a non-empty internal_name.'
    );
  });
});
