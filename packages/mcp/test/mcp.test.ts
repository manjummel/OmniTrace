import { describe, it, expect } from 'vitest';
import { BlastRadiusMCPServer } from '../src/index.js';

describe('Milestone 6: Model Context Protocol (MCP) Server', () => {
  it('should initialize MCP server with registered tools', async () => {
    const mcpServer = new BlastRadiusMCPServer();
    expect(mcpServer).toBeDefined();
  });
});

