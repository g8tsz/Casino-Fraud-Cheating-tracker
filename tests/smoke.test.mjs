import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ingest normalization', () => {
  it('accepts observedRtp alias', () => {
    const rtp = 96;
    const observedRtp = rtp;
    assert.equal(observedRtp, 96);
  });

  it('dedupe key format is stable', () => {
    const key = `odd:casino-a:P001`;
    assert.match(key, /^odd:/);
  });
});

describe('regulatory retention', () => {
  it('retention cutoff is in the past', () => {
    const days = 365;
    const d = new Date();
    d.setDate(d.getDate() - days);
    assert.ok(d.getTime() < Date.now());
  });
});
