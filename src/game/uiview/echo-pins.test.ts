import { expect, test } from 'bun:test';
import { custodianMarked } from './echo-pins.ts';

test('the Custodian reveals exactly the three vaults after the conversation', () => {
  for (const place of ['pumphouse', 'lampgallery', 'seedvault']) {
    expect(custodianMarked(false, place)).toBe(false);
    expect(custodianMarked(true, place)).toBe(true);
  }
  for (const place of ['shrine-oak', 'ruin-tower', 'hall', 'rootworks']) expect(custodianMarked(true, place)).toBe(false);
});
