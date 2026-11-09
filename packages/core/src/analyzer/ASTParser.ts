import {
  Project,
  SourceFile,
  SyntaxKind,
  Node,
  FunctionDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  VariableDeclaration,
  CallExpression
} from 'ts-morph';
import path from 'node:path';
import type { GraphNode, GraphEdge, NodeKind } from '../types/index.js';

export interface ParsedFileResult {
  filePath: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  unresolvedImports: Array<{ specifier: string; line: number }>;
  syntaxErrors: Array<{ message: string; line: number }>;
}

export class ASTParser {
  private project: Project;

  constructor(projectRoot?: string, tsConfigFilePath?: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigFilePath,
      skipAddingFilesFromTsConfig: !tsConfigFilePath,
      compilerOptions: {
        allowJs: true,
        jsx: 1, // Preserve
        target: 99 // ESNext
      }
    });

    if (projectRoot && !tsConfigFilePath) {
      this.project.addSourceFilesAtPaths([
        path.join(projectRoot, '**/*.{ts,tsx,js,jsx}'),
        `!${path.join(projectRoot, '**/node_modules/**')}`,
        `!${path.join(projectRoot, '**/dist/**')}`,
        `!${path.join(projectRoot, '**/.git/**')}`
      ]);
    }
  }

  public getProject(): Project {
    return this.project;
  }

  public parseSourceFile(sourceFile: SourceFile): ParsedFileResult {
    const rawPath = sourceFile.getFilePath();
    // Normalize path to forward slashes
    const filePath = rawPath.replace(/\\/g, '/');
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const unresolvedImports: Array<{ specifier: string; line: number }> = [];
    const syntaxErrors: Array<{ message: string; line: number }> = [];

    // Check for syntax diagnostics
    const preDiagnostics = sourceFile.getPreEmitDiagnostics();
    for (const diag of preDiagnostics) {
      const line = diag.getLineNumber() || 1;
      const msgText = diag.getMessageText();
      const message = typeof msgText === 'string' ? msgText : (msgText as any).messageText || String(msgText);
      syntaxErrors.push({
        message,
        line
      });
    }

    const isTestFile =
      filePath.includes('.test.') ||
      filePath.includes('.spec.') ||
      filePath.includes('__tests__');

    // 1. Create File Node
    const fileNodeId = `file:${filePath}`;
    const fileNode: GraphNode = {
      id: fileNodeId,
      label: path.basename(filePath),
      kind: isTestFile ? 'test' : 'file',
      filePath,
      line: 1,
      column: 1,
      isExported: false,
      metrics: {
        incomingCallsCount: 0,
        outgoingCallsCount: 0,
        transitiveImpactCount: 0,
        blastRadiusScore: 0,
        riskTier: 'LOW',
        hasFindings: syntaxErrors.length > 0
      }
    };
    nodes.push(fileNode);

    // 2. Extract Functions
    sourceFile.getFunctions().forEach((fn: FunctionDeclaration) => {
      const name = fn.getName() || 'anonymousFunction';
      const line = fn.getStartLineNumber();
      const isExported = fn.isExported();
      const fnNodeId = `func:${filePath}:${name}:${line}`;

      const fnNode: GraphNode = {
        id: fnNodeId,
        label: name,
        kind: 'function',
        filePath,
        line,
        column: 1,
        isExported,
        metrics: {
          incomingCallsCount: 0,
          outgoingCallsCount: 0,
          transitiveImpactCount: 0,
          blastRadiusScore: 0,
          riskTier: 'LOW',
          hasFindings: false
        }
      };
      nodes.push(fnNode);

      // Edge from file to its contained function
      edges.push({
        id: `contains:${fileNodeId}->${fnNodeId}`,
        source: fileNodeId,
        target: fnNodeId,
        type: 'calls',
        confidence: 'exact'
      });
    });

    // 3. Extract Classes and Methods
    sourceFile.getClasses().forEach((cls: ClassDeclaration) => {
      const name = cls.getName() || 'AnonymousClass';
      const line = cls.getStartLineNumber();
      const isExported = cls.isExported();
      const clsNodeId = `class:${filePath}:${name}`;

      const clsNode: GraphNode = {
        id: clsNodeId,
        label: name,
        kind: 'class',
        filePath,
        line,
        column: 1,
        isExported,
        metrics: {
          incomingCallsCount: 0,
          outgoingCallsCount: 0,
          transitiveImpactCount: 0,
          blastRadiusScore: 0,
          riskTier: 'LOW',
          hasFindings: false
        }
      };
      nodes.push(clsNode);

      edges.push({
        id: `contains:${fileNodeId}->${clsNodeId}`,
        source: fileNodeId,
        target: clsNodeId,
        type: 'instantiates',
        confidence: 'exact'
      });

      // Methods inside class
      cls.getMethods().forEach((m) => {
        const mName = m.getName();
        const mLine = m.getStartLineNumber();
        const mNodeId = `func:${filePath}:${name}.${mName}:${mLine}`;

        nodes.push({
          id: mNodeId,
          label: `${name}.${mName}`,
          kind: 'function',
          filePath,
          line: mLine,
          column: 1,
          isExported,
          metrics: {
            incomingCallsCount: 0,
            outgoingCallsCount: 0,
            transitiveImpactCount: 0,
            blastRadiusScore: 0,
            riskTier: 'LOW',
            hasFindings: false
          }
        });

        edges.push({
          id: `member:${clsNodeId}->${mNodeId}`,
          source: clsNodeId,
          target: mNodeId,
          type: 'calls',
          confidence: 'exact'
        });
      });
    });

    // 4. Extract Interfaces
    sourceFile.getInterfaces().forEach((intf: InterfaceDeclaration) => {
      const name = intf.getName();
      const line = intf.getStartLineNumber();
      const isExported = intf.isExported();
      const intfNodeId = `interface:${filePath}:${name}`;

      nodes.push({
        id: intfNodeId,
        label: name,
        kind: 'interface',
        filePath,
        line,
        column: 1,
        isExported,
        metrics: {
          incomingCallsCount: 0,
          outgoingCallsCount: 0,
          transitiveImpactCount: 0,
          blastRadiusScore: 0,
          riskTier: 'LOW',
          hasFindings: false
        }
      });
    });

    // 5. Extract Imports and Link Files
    sourceFile.getImportDeclarations().forEach((imp) => {
      const specifier = imp.getModuleSpecifierValue();
      const line = imp.getStartLineNumber();

      // Resolve module
      const targetSourceFile = imp.getModuleSpecifierSourceFile();
      if (targetSourceFile) {
        const targetPath = targetSourceFile.getFilePath().replace(/\\/g, '/');
        const targetFileNodeId = `file:${targetPath}`;

        edges.push({
          id: `import:${fileNodeId}->${targetFileNodeId}:${line}`,
          source: fileNodeId,
          target: targetFileNodeId,
          type: 'imports',
          confidence: 'exact',
          line
        });
      } else {
        // External package or unresolved
        if (specifier.startsWith('.')) {
          unresolvedImports.push({ specifier, line });
        }
      }
    });

    // 6. Extract Call Expressions (Calls)
    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpr = node as CallExpression;
        const line = callExpr.getStartLineNumber();
        const expr = callExpr.getExpression();
        const callText = expr.getText();

        // Determine containing function or file
        const containingFunc = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
        const callerId = containingFunc
          ? `func:${filePath}:${containingFunc.getName() || 'anonymous'}:${containingFunc.getStartLineNumber()}`
          : fileNodeId;

        // Dynamic imports: import(...)
        if (callExpr.getText().startsWith('import(')) {
          edges.push({
            id: `dyn_import:${callerId}->${callText}:${line}`,
            source: callerId,
            target: `unresolved:${callText}`,
            type: 'imports',
            confidence: 'uncertain',
            line
          });
          return;
        }

        // Try to resolve definition symbol
        try {
          const symbol = expr.getSymbol();
          if (symbol) {
            const declarations = symbol.getDeclarations();
            if (declarations.length > 0) {
              const decl = declarations[0];
              const declFile = decl.getSourceFile().getFilePath().replace(/\\/g, '/');
              const declLine = decl.getStartLineNumber();
              const declName = symbol.getName();

              const targetId =
                decl.getKind() === SyntaxKind.FunctionDeclaration ||
                decl.getKind() === SyntaxKind.MethodDeclaration
                  ? `func:${declFile}:${declName}:${declLine}`
                  : `file:${declFile}`;

              if (callerId !== targetId) {
                edges.push({
                  id: `call:${callerId}->${targetId}:${line}`,
                  source: callerId,
                  target: targetId,
                  type: 'calls',
                  confidence: 'exact',
                  line
                });
              }
            }
          } else {
            // Unresolved call
            edges.push({
              id: `call_unresolved:${callerId}->${callText}:${line}`,
              source: callerId,
              target: `unresolved:${callText}`,
              type: 'calls',
              confidence: 'uncertain',
              line
            });
          }
        } catch {
          // If type checking resolution fails, mark as uncertain
          edges.push({
            id: `call_uncertain:${callerId}->${callText}:${line}`,
            source: callerId,
            target: `uncertain:${callText}`,
            type: 'calls',
            confidence: 'uncertain',
            line
          });
        }
      }
    });

    return {
      filePath,
      nodes,
      edges,
      unresolvedImports,
      syntaxErrors
    };
  }
}
