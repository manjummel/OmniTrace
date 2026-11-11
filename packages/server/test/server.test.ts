import { describe, it, expect, afterAll } from 'vitest';
import { BlastRadiusServer } from '../src/index.js';

describe('Milestone 7: Local Server & WebSocket Bridge', () => {
  let server: BlastRadiusServer;

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('should initialize and start the local server on an available port', async () => {
    server = new BlastRadiusServer({ port: 4899 });
    const port = await server.start(4899);
    expect(port).toBe(4899);

    const res = await fetch(`http://localhost:${port}/api/status`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ONLINE');
    expect(data.policy).toBeDefined();
    expect(data.firebaseSyncEnabled).toBe(false); // Graceful offline/local mode
  }, 25000);
});
