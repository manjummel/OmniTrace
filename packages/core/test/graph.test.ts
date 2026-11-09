import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ASTParser } from '../src/analyzer/ASTParser.js';
import { ProjectGraph } from '../src/analyzer/ProjectGraph.js';
import { CallGraphBuilder } from '../src/analyzer/CallGraphBuilder.js';

describe('Milestone 2: AST Parser, Dependency Extractor & Call Graph', () => {
  let parser: ASTParser;
  let graph: ProjectGraph;

  beforeEach(() => {
    parser = new ASTParser();
    graph = new ProjectGraph();
  });

  it('should parse exports, functions, and cross-file imports', () => {
    const project = parser.getProject();
    
    // Virtual file 1: Math utility
    const mathFile = project.createSourceFile('src/utils/math.ts', `
      export function add(a: number, b: number): number {
        return a + b;
      }
      export function multiply(a: number, b: number): number {
        return a * b;
      }
    `, { overwrite: true });

    // Virtual file 2: Calculator service calling math
    const calcFile = project.createSourceFile('src/services/calculator.ts', `
      import { add, multiply } from '../utils/math';

      export class CalculatorService {
        computeTotal(items: number[]): number {
          return items.reduce((acc, curr) => add(acc, curr), 0);
        }
      }
    `, { overwrite: true });

    const mathParsed = parser.parseSourceFile(mathFile);
    const calcParsed = parser.parseSourceFile(calcFile);

    // Verify Math file nodes
    expect(mathParsed.nodes.some(n => n.label === 'add' && n.kind === 'function')).toBe(true);
    expect(mathParsed.nodes.some(n => n.label === 'multiply' && n.kind === 'function')).toBe(true);

    // Verify Calculator file nodes
    expect(calcParsed.nodes.some(n => n.label === 'CalculatorService' && n.kind === 'class')).toBe(true);
    expect(calcParsed.nodes.some(n => n.label === 'CalculatorService.computeTotal' && n.kind === 'function')).toBe(true);

    // Add to graph
    for (const n of [...mathParsed.nodes, ...calcParsed.nodes]) {
      graph.addNode(n);
    }
    for (const e of [...mathParsed.edges, ...calcParsed.edges]) {
      graph.addEdge(e);
    }

    graph.recalculateAllMetrics();

    // Verify import edge exists
    const importEdge = graph.getAllEdges().find(e => e.type === 'imports');
    expect(importEdge).toBeDefined();

    const graphData = graph.toJSON();
    expect(graphData.nodes.length).toBeGreaterThanOrEqual(4);
    expect(graphData.summary.totalFunctions).toBeGreaterThanOrEqual(3);
  });

  it('should correctly calculate downstream blast radius and metrics', () => {
    const project = parser.getProject();

    // Core primitive
    const coreFile = project.createSourceFile('src/core/auth.ts', `
      export function verifyToken(token: string): boolean {
        return token.length > 5;
      }
    `, { overwrite: true });

    // Middleware consumer
    const mwFile = project.createSourceFile('src/middleware/authMw.ts', `
      import { verifyToken } from '../core/auth';
      export function authenticate(req: any): boolean {
        return verifyToken(req.token);
      }
    `, { overwrite: true });

    // API route consumer
    const routeFile = project.createSourceFile('src/api/routes.ts', `
      import { authenticate } from '../middleware/authMw';
      export function handleRequest(req: any) {
        if (!authenticate(req)) throw new Error('Unauthorized');
      }
    `, { overwrite: true });

    for (const sf of [coreFile, mwFile, routeFile]) {
      const parsed = parser.parseSourceFile(sf);
      for (const n of parsed.nodes) graph.addNode(n);
      for (const e of parsed.edges) graph.addEdge(e);
    }

    graph.recalculateAllMetrics();

    const authFileNode = graph.getAllNodes().find(n => n.filePath.includes('auth.ts') && n.kind === 'file');
    expect(authFileNode).toBeDefined();

    if (authFileNode) {
      const directCallers = graph.getDirectCallers(authFileNode.id);
      expect(directCallers.length).toBeGreaterThan(0);

      const impact = graph.getDownstreamImpact(authFileNode.id);
      expect(impact.nodes.length).toBeGreaterThan(0);
    }
  });

  it('should flag dynamic imports with uncertain confidence', () => {
    const project = parser.getProject();
    const dynFile = project.createSourceFile('src/plugins/loader.ts', `
      export async function loadPlugin(name: string) {
        return await import('./plugins/' + name);
      }
    `, { overwrite: true });

    const parsed = parser.parseSourceFile(dynFile);
    const uncertainEdge = parsed.edges.find(e => e.confidence === 'uncertain');
    expect(uncertainEdge).toBeDefined();
    expect(uncertainEdge?.type).toBe('imports');
  });
});

