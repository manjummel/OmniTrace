import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ASTParser } from '../src/analyzer/ASTParser.js';
import { HardcodeHunterAgent } from '../src/agents/HardcodeHunterAgent.js';

describe('Agent: Hardcode Hunter', () => {
  let project: Project;
  let hunter: HardcodeHunterAgent;

  beforeEach(() => {
    const parser = new ASTParser();
    project = parser.getProject();
    hunter = new HardcodeHunterAgent();
  });

  it('should detect credentials and safely redact evidence', () => {
    const sf = project.createSourceFile('src/secrets.ts', `
      const awsKey = "AKIA1234567890ABCDEF";
      const openAiKey = "sk-proj-abc1234567890xyz9876543210abcd";
      const localPath = "C:\\\\Users\\\\JohnDoe\\\\project\\\\secret.json";
    `, { overwrite: true });

    const findings = hunter.analyze(sf);

    expect(findings.length).toBeGreaterThanOrEqual(3);

    const awsFinding = findings.find(f => f.title.includes('AWS Access Key'));
    expect(awsFinding).toBeDefined();
    expect(awsFinding?.evidence).not.toContain('AKIA1234567890ABCDEF'); // Must be redacted
    expect(awsFinding?.evidence).toContain('••••');

    const openAiFinding = findings.find(f => f.title.includes('OpenAI API Key'));
    expect(openAiFinding).toBeDefined();
    expect(openAiFinding?.evidence).not.toContain('abc1234567890xyz');
    expect(openAiFinding?.evidence).toContain('••••');
  });

  it('should correctly calculate Shannon entropy for random keys', () => {
    const lowEntropy = hunter.calculateEntropy('aaaaaaaaaaaaaa');
    const highEntropy = hunter.calculateEntropy('d8f37b92ac71e405f6e8a1b2c3d4');

    expect(lowEntropy).toBeLessThan(1.0);
    expect(highEntropy).toBeGreaterThan(3.5);
  });
});
