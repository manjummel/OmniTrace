import { describe, it, expect } from 'vitest';
import { ScopeGuardAgent } from '../src/agents/ScopeGuardAgent.js';

describe('Agent: Scope Guard', () => {
  it('should flag unauthorized lockfile and CI pipeline edits', () => {
    const scopeGuard = new ScopeGuardAgent();

    const findings = scopeGuard.analyze({
      taskDescription: 'Fix button color on login page',
      modifiedFiles: [
        'src/components/LoginButton.tsx',
        'package-lock.json',
        '.github/workflows/deploy.yml'
      ]
    });

    expect(findings.length).toBe(2);
    expect(findings.some(f => f.title.includes('lockfile'))).toBe(true);
    expect(findings.some(f => f.title.includes('CI pipeline'))).toBe(true);
  });

  it('should allow lockfile changes when explicitly requested', () => {
    const scopeGuard = new ScopeGuardAgent();

    const findings = scopeGuard.analyze({
      taskDescription: 'Upgrade dependencies and update package-lock.json',
      modifiedFiles: ['package-lock.json']
    });

    expect(findings.length).toBe(0);
  });
});
