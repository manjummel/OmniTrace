import { SourceFile, SyntaxKind, CallExpression } from 'ts-morph';
import path from 'node:path';
import type { Finding } from '../types/index.js';

export class RealityCheckAgent {
  public readonly name = 'Reality Check' as const;

  /**
   * Analyzes a source file for non-existent imports, missing exports, and argument count mismatches
   */
  public analyze(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];
    const rawPath = sourceFile.getFilePath();
    const filePath = rawPath.replace(/\\/g, '/');

    // 1. Inspect Imports
    const importDecls = sourceFile.getImportDeclarations();
    for (const imp of importDecls) {
      const specifier = imp.getModuleSpecifierValue();
      const line = imp.getStartLineNumber();

      // Only check local relative imports
      if (specifier.startsWith('.')) {
        const targetSource = imp.getModuleSpecifierSourceFile();
        if (!targetSource) {
          findings.push({
            id: `rc-imp-${filePath}-${line}`,
            agent: this.name,
            filePath,
            line,
            severity: 'CRITICAL',
            confidence: 0.99,
            title: `Unresolved module import '${specifier}'`,
            evidence: imp.getText(),
            explanation: `The file '${specifier}' does not exist on disk or in the project. Importing non-existent modules will cause runtime crashes.`,
            suggestedFix: `Check the file path spelling or ensure the target module is created before importing.`,
            timestamp: Date.now(),
            status: 'ACTIVE'
          });
          continue;
        }

        // Check named imports against exported symbols
        const namedImports = imp.getNamedImports();
        for (const named of namedImports) {
          const importedName = named.getName();
          const targetExports = targetSource.getExportedDeclarations();
          if (!targetExports.has(importedName)) {
            const availableExports = Array.from(targetExports.keys()).join(', ');
            findings.push({
              id: `rc-export-${filePath}-${line}-${importedName}`,
              agent: this.name,
              filePath,
              line,
              severity: 'CRITICAL',
              confidence: 0.97,
              title: `Module has no exported member '${importedName}'`,
              evidence: imp.getText(),
              explanation: `Module '${specifier}' does not export '${importedName}'. Available exports are: [${availableExports || 'none'}].`,
              suggestedFix: availableExports
                ? `Update import to use an existing export: { ${availableExports.split(', ')[0]} }`
                : `Export '${importedName}' from '${path.basename(targetSource.getFilePath())}' or import the correct symbol.`,
              timestamp: Date.now(),
              status: 'ACTIVE'
            });
          }
        }
      }
    }

    // 2. Inspect Function Call Argument Counts
    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const call = node as CallExpression;
        const line = call.getStartLineNumber();
        const expr = call.getExpression();
        const args = call.getArguments();

        try {
          const symbol = expr.getSymbol();
          if (symbol) {
            const decls = symbol.getDeclarations();
            for (const decl of decls) {
              if (decl.getKind() === SyntaxKind.FunctionDeclaration || decl.getKind() === SyntaxKind.MethodDeclaration) {
                const fnDecl = decl as any;
                if (typeof fnDecl.getParameters === 'function') {
                  const params = fnDecl.getParameters();
                  const requiredParams = params.filter((p: any) => !p.isOptional() && !p.hasInitializer());
                  
                  if (args.length < requiredParams.length) {
                    findings.push({
                      id: `rc-args-${filePath}-${line}`,
                      agent: this.name,
                      filePath,
                      line,
                      severity: 'HIGH',
                      confidence: 0.92,
                      title: `Expected at least ${requiredParams.length} argument(s), but got ${args.length}`,
                      evidence: call.getText(),
                      explanation: `Function '${expr.getText()}' requires parameter(s): ${requiredParams.map((p: any) => p.getName()).join(', ')}.`,
                      suggestedFix: `Provide the missing required argument(s) to '${expr.getText()}'.`,
                      timestamp: Date.now(),
                      status: 'ACTIVE'
                    });
                  }
                }
              }
            }
          }
        } catch {
          // Ignore symbol resolution errors in dynamic contexts
        }
      }
    });

    // 3. Inspect Pre-Emit Compiler Diagnostics
    const diagnostics = sourceFile.getPreEmitDiagnostics();
    for (const diag of diagnostics) {
      const code = diag.getCode();
      const line = diag.getLineNumber() || 1;
      const msgText = diag.getMessageText();
      const message = typeof msgText === 'string' ? msgText : (msgText as any).messageText || String(msgText);

      // TS2304: Cannot find name
      // TS2307: Cannot find module
      // TS2305: Module has no exported member
      // TS2554: Expected N arguments, but got M
      if ([2304, 2307, 2305, 2554].includes(code)) {
        // Only add if not already captured
        const alreadyFound = findings.some(f => f.line === line && f.title.includes(String(code)));
        if (!alreadyFound) {
          findings.push({
            id: `rc-diag-${filePath}-${line}-${code}`,
            agent: this.name,
            filePath,
            line,
            severity: code === 2307 || code === 2305 ? 'CRITICAL' : 'HIGH',
            confidence: 0.98,
            title: `TypeScript Diagnostic TS${code}: ${message}`,
            evidence: sourceFile.getFullText().split('\n')[line - 1]?.trim() || '',
            explanation: message,
            suggestedFix: 'Resolve compiler error according to TypeScript diagnostic guidance.',
            timestamp: Date.now(),
            status: 'ACTIVE'
          });
        }
      }
    }

    return findings;
  }
}
