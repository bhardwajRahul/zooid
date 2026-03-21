import { describe, it, expect } from 'vitest';
import { isZoonHosted } from '../lib/zoon';

describe('Zoon-hosted deploy detection', () => {
  it('detects *.zoon.eco as Zoon-hosted', () => {
    expect(isZoonHosted('https://beno.zoon.eco')).toBe(true);
    expect(isZoonHosted('https://signals.zoon.eco')).toBe(true);
  });

  it('detects non-zoon as self-hosted', () => {
    expect(isZoonHosted('https://my-zooid.workers.dev')).toBe(false);
    expect(isZoonHosted('https://zooid.example.com')).toBe(false);
    expect(isZoonHosted('http://localhost:8787')).toBe(false);
  });
});
