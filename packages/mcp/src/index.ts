import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import path from 'node:path';
import {
  CallGraphBuilder,
  AgentCoordinator,
  PatchManager
} from '@blast-radius/core';
import type { Finding } from '@blast-radius/core';

export class BlastRadiusMCPServer {
  private server: Server;
  private builder: CallGraphBuilder;
  private coordinator: AgentCoordinator;
  private patchManager: PatchManager;
  private projectRoot: string;
  private cachedFindings: Finding[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.builder = new CallGraphBuilder(this.projectRoot);
    this.coordinator = new AgentCoordinator(
      this.builder.getParser().getProject(),
      this.builder.getGraph()
    );
    this.patchManager = new PatchManager();

    this.server = new Server(
      {
        name: 'blast-radius-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 1. List Available Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'impact',
            description:
              'Analyzes the downstream blast radius, affected callers, and impacted test suites for a given file or symbol before or after modifying it.',
            inputSchema: {
              type: 'object',
              properties: {
                targetFile: {
                  type: 'string',
                  description: 'Relative or absolute path to the file being inspected.'
                },
                targetSymbol: {
                  type: 'string',
                  description: 'Optional symbol or function name within the file.'
                }
              },
              required: ['targetFile']
            }
          },
          {
            name: 'hotspots',
            description:
              'Retrieves architectural dependency hotspots in the project, ranked by fan-in, fan-out, and Blast Radius Score.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of hotspots to return (default: 10).'
                }
              }
            }
          },
          {
            name: 'findings',
            description:
              'Retrieves safety findings detected by the 5 Blast Radius analysis agents (Reality Check, Hardcode Hunter, Scope Guard, Test Guardian, Impact Analyst).',
            inputSchema: {
              type: 'object',
              properties: {
                severity: {
                  type: 'string',
                  enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
                  description: 'Optional filter by severity tier.'
                },
                agent: {
                  type: 'string',
                  description: 'Optional filter by agent name.'
                }
              }
            }
          },
          {
            name: 'fix',
            description:
              'Generates a proposed unified diff fix for a detected finding, with an option to preview or apply with rollback protection.',
            inputSchema: {
              type: 'object',
              properties: {
                findingId: {
                  type: 'string',
                  description: 'Unique identifier of the finding to remediate.'
                },
                apply: {
                  type: 'boolean',
                  description: 'If true, writes the proposed fix directly to disk and records a rollback snapshot.'
                }
              },
              required: ['findingId']
            }
          }
        ]
      };
    });

    // 2. Handle Tool Calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'impact') {
          const targetFile = String(args?.targetFile || '');
          const normalizedPath = path.resolve(this.projectRoot, targetFile).replace(/\\/g, '/');
          const fileNodeId = `file:${normalizedPath}`;

          let report = this.builder.generateBlastRadiusReport(fileNodeId);
          if (!report) {
            // Try updating file into graph first
            this.builder.updateFile(normalizedPath);
            report = this.builder.generateBlastRadiusReport(fileNodeId);
          }

          if (!report) {
            return {
              content: [
                {
                  type: 'text',
                  text: `File '${targetFile}' could not be resolved in the static project graph.`
                }
              ]
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    target: targetFile,
                    score: report.score,
                    riskTier: report.riskTier,
                    directCallersCount: report.directCallers.length,
                    transitiveImpactCount: report.transitiveCallers.length,
                    affectedFiles: report.affectedFiles,
                    affectedTests: report.affectedTests,
                    breakdown: report.breakdown
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        if (name === 'hotspots') {
          const limit = typeof args?.limit === 'number' ? args.limit : 10;
          const hotspots = this.builder.getGraph().getHotspots(limit);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(hotspots, null, 2)
              }
            ]
          };
        }

        if (name === 'findings') {
          // Re-analyze project
          const result = this.coordinator.analyzeProject();
          this.cachedFindings = result.findings;

          let filtered = result.findings;
          if (args?.severity) {
            filtered = filtered.filter((f) => f.severity === args.severity);
          }
          if (args?.agent) {
            filtered = filtered.filter((f) => f.agent === args.agent);
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    total: filtered.length,
                    summary: result.summary,
                    findings: filtered
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        if (name === 'fix') {
          const findingId = String(args?.findingId || '');
          const apply = Boolean(args?.apply);

          const finding = this.cachedFindings.find((f) => f.id === findingId);
          if (!finding) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Finding with ID '${findingId}' was not found. Call 'findings' tool first to retrieve active IDs.`
                }
              ]
            };
          }

          const patch = this.patchManager.generateFix(finding);
          if (!patch) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Unable to automatically synthesize a deterministic patch for finding '${findingId}'.`
                }
              ]
            };
          }

          if (apply) {
            const applyResult = this.patchManager.applyPatch(patch);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      status: applyResult.success ? 'APPLIED' : 'FAILED',
                      rollbackId: applyResult.rollbackId,
                      diffSummary: patch.diffSummary,
                      error: applyResult.error
                    },
                    null,
                    2
                  )
                }
              ]
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    findingId,
                    filePath: patch.filePath,
                    diffSummary: patch.diffSummary,
                    proposedContentPreview: patch.newContent.slice(0, 500)
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool name: ${name}` }]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }]
        };
      }
    });
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start stdio server if invoked directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const mcpServer = new BlastRadiusMCPServer();
  mcpServer.start().catch((err) => {
    console.error('Fatal MCP Server Error:', err);
    process.exit(1);
  });
}

