import { describe, it, expect } from 'vitest';
import { runHook } from '../src/index.js';

describe('Claude Code Hook Integration', () => {
  it('should export runHook and complete execution without hanging', async () => {
    // Process env recursion guard test
    process.env.BLAST_RADIUS_INSPECTION = '1';
    const code = await runHook();
    expect(code).toBe(0);
  });
});
