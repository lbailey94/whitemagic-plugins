import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyReceiptBundle, qualifiedReferenceVersion, validTimestamp} from '../bin/verify-receipt.mjs';

test('older or unknown reference versions cannot earn conformance labels',()=>{
  for(const version of ['0.1.0','0.1.1','0.2.0','1.0.0','0.1.2-beta','garbage']) assert.equal(qualifiedReferenceVersion(version),false);
  assert.equal(qualifiedReferenceVersion('0.1.2'),true);
});
test('calendar controls reject normalization and trailing-newline spellings',()=>{
  for(const stamp of ['2026-02-30T00:00:00Z','0000-01-01T00:00:00Z','2024-02-29T24:00:00Z','2024-01-01T00:00:60Z','2024-01-01T00:00:00Z\n']) assert.equal(validTimestamp(stamp),false);
  for(const stamp of ['2024-02-29T23:59:59.001Z','0001-01-01T00:00:00Z','9999-12-31T23:59:59Z']) assert.equal(validTimestamp(stamp),true);
});
test('signed impossible date is never accepted as a trusted receipt',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/cr/signed-timestamp-boundaries.json',import.meta.url)));
  const result=await verifyReceiptBundle(fixture.invalid_bundle);
  assert.notEqual(result.verdict,'TRUSTED');
});
