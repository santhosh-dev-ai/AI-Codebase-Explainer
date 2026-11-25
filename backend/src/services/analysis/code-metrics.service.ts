import ts from 'typescript';
import path from 'path';
import { execFileSync } from 'child_process';
import logger from '../../utils/logger.util';
import {
  RepositoryMetrics,
  FileLineMetrics,
  LanguageMetric,
  ComplexityMetricsSummary,
  FileComplexityMetric,
  TestIntelligenceMetrics,
  MetricProvenance,
} from '../../types/analysis.types';
import { RepoMetadata } from '../../types/repository.types';

export class CodeMetricsService {
  /**
   * Identifies the language of a file based on its path and extension.
   */
  public detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    if (basename === 'dockerfile') return 'docker';
    if (basename === 'makefile') return 'make';

    switch (ext) {
      case '.ts':
        return 'typescript';
      case '.tsx':
        return 'typescript-react';
      case '.js':
      case '.mjs':
      case '.cjs':
        return 'javascript';
      case '.jsx':
        return 'javascript-react';
      case '.py':
      case '.pyw':
      case '.pyi':
        return 'python';
      case '.java':
        return 'java';
      case '.json':
      case '.jsonc':
      case '.json5':
        return 'json';
      case '.css':
      case '.scss':
      case '.sass':
      case '.less':
        return 'css';
      case '.html':
      case '.htm':
      case '.xhtml':
      case '.xml':
      case '.svg':
        return 'html';
      case '.c':
      case '.h':
        return 'c';
      case '.cpp':
      case '.cc':
      case '.cxx':
      case '.hpp':
      case '.hh':
        return 'cpp';
      case '.cs':
        return 'csharp';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.rb':
        return 'ruby';
      case '.sh':
      case '.bash':
      case '.zsh':
        return 'shell';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.md':
      case '.markdown':
        return 'markdown';
      case '.sql':
        return 'sql';
      default:
        return 'plaintext';
    }
  }

  /**
   * Accurately calculates language-aware Lines of Code (LOC) for a given file.
   * Invariant: codeLines + commentLines + blankLines === totalLines
   */
  public analyzeFileLines(
    filePath: string,
    content: string,
    language?: string
  ): {
    totalLines: number;
    codeLines: number;
    blankLines: number;
    commentLines: number;
    mixedLines: number;
  } {
    const lang = language || this.detectLanguage(filePath);
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    let blankLines = 0;
    let commentLines = 0;
    let codeLines = 0;
    let mixedLines = 0;

    let inBlockComment = false;
    let inDocstring = false;
    let docstringDelim = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        blankLines++;
        continue;
      }

      // 1. JSON has no comments (unless jsonc)
      if (lang === 'json' && !filePath.endsWith('.jsonc')) {
        codeLines++;
        continue;
      }

      // 2. Markdown / Plain text - all non-blank lines are content/code
      if (lang === 'markdown' || lang === 'plaintext') {
        codeLines++;
        continue;
      }

      // 3. HTML / XML Comments (<!-- ... -->)
      if (lang === 'html') {
        if (inBlockComment) {
          const endIdx = trimmed.indexOf('-->');
          if (endIdx !== -1) {
            inBlockComment = false;
            const remaining = trimmed.substring(endIdx + 3).trim();
            if (remaining.length > 0) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
          } else {
            commentLines++;
          }
          continue;
        }

        const startIdx = trimmed.indexOf('<!--');
        if (startIdx !== -1) {
          const endIdx = trimmed.indexOf('-->', startIdx + 4);
          if (endIdx !== -1) {
            // Entire comment on this line
            const before = trimmed.substring(0, startIdx).trim();
            const after = trimmed.substring(endIdx + 3).trim();
            if (before.length > 0 || after.length > 0) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
          } else {
            inBlockComment = true;
            const before = trimmed.substring(0, startIdx).trim();
            if (before.length > 0) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
          }
          continue;
        }

        codeLines++;
        continue;
      }

      // 4. Python Comments (# and multiline docstrings """ or ''')
      if (lang === 'python') {
        if (inDocstring) {
          const endIdx = trimmed.indexOf(docstringDelim);
          if (endIdx !== -1) {
            inDocstring = false;
            const after = trimmed.substring(endIdx + docstringDelim.length).trim();
            if (after.length > 0 && !after.startsWith('#')) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
          } else {
            commentLines++;
          }
          continue;
        }

        // Check for start of docstring
        const hasTripleDouble = trimmed.includes('"""');
        const hasTripleSingle = trimmed.includes("'''");
        if (hasTripleDouble || hasTripleSingle) {
          const delim = hasTripleDouble ? '"""' : "'''";
          const startIdx = trimmed.indexOf(delim);
          const endIdx = trimmed.indexOf(delim, startIdx + 3);

          if (endIdx !== -1) {
            // Single-line docstring
            const before = trimmed.substring(0, startIdx).trim();
            const after = trimmed.substring(endIdx + 3).trim();
            if (before.length > 0) {
              codeLines++;
              mixedLines++;
            } else if (after.length > 0 && !after.startsWith('#')) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
            continue;
          } else {
            // Multi-line docstring started
            inDocstring = true;
            docstringDelim = delim;
            const before = trimmed.substring(0, startIdx).trim();
            if (before.length > 0) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
            continue;
          }
        }

        // Single-line hash comment
        if (trimmed.startsWith('#')) {
          commentLines++;
          continue;
        }

        if (trimmed.includes('#')) {
          // Check if hash is inside a string
          let inSingleQuote = false;
          let inDoubleQuote = false;
          let hasCodeBefore = false;
          let hasComment = false;

          for (let c = 0; c < trimmed.length; c++) {
            const char = trimmed[c];
            if (char === "'" && (c === 0 || trimmed[c - 1] !== '\\')) {
              if (!inDoubleQuote) inSingleQuote = !inSingleQuote;
            } else if (char === '"' && (c === 0 || trimmed[c - 1] !== '\\')) {
              if (!inSingleQuote) inDoubleQuote = !inDoubleQuote;
            } else if (char === '#' && !inSingleQuote && !inDoubleQuote) {
              hasComment = true;
              break;
            } else if (!/\s/.test(char)) {
              hasCodeBefore = true;
            }
          }

          if (hasComment && hasCodeBefore) {
            codeLines++;
            mixedLines++;
            continue;
          } else if (hasComment && !hasCodeBefore) {
            commentLines++;
            continue;
          }
        }

        codeLines++;
        continue;
      }

      // 5. C-style languages (JS, TS, Java, C, C++, C#, Go, Rust, CSS)
      if (
        lang === 'javascript' ||
        lang === 'javascript-react' ||
        lang === 'typescript' ||
        lang === 'typescript-react' ||
        lang === 'java' ||
        lang === 'c' ||
        lang === 'cpp' ||
        lang === 'csharp' ||
        lang === 'go' ||
        lang === 'rust' ||
        lang === 'css'
      ) {
        if (inBlockComment) {
          const endIdx = trimmed.indexOf('*/');
          if (endIdx !== -1) {
            inBlockComment = false;
            const remaining = trimmed.substring(endIdx + 2).trim();
            if (remaining.length > 0 && !remaining.startsWith('//')) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
          } else {
            commentLines++;
          }
          continue;
        }

        // Check for line comment starting at col 0
        if (trimmed.startsWith('//')) {
          commentLines++;
          continue;
        }

        // Check for block comment
        const blockStart = trimmed.indexOf('/*');
        if (blockStart !== -1) {
          const blockEnd = trimmed.indexOf('*/', blockStart + 2);
          if (blockEnd !== -1) {
            // Block comment begins and ends on this line
            const before = trimmed.substring(0, blockStart).trim();
            const after = trimmed.substring(blockEnd + 2).trim();
            if (before.length > 0 || (after.length > 0 && !after.startsWith('//'))) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
            continue;
          } else {
            // Block comment begins on this line and continues
            inBlockComment = true;
            const before = trimmed.substring(0, blockStart).trim();
            if (before.length > 0) {
              codeLines++;
              mixedLines++;
            } else {
              commentLines++;
            }
            continue;
          }
        }

        // Inline single-line comment
        if (trimmed.includes('//')) {
          // Check if // is inside string
          let inSQ = false;
          let inDQ = false;
          let inBT = false;
          let isComment = false;
          let codeBefore = false;

          for (let c = 0; c < trimmed.length; c++) {
            const ch = trimmed[c];
            if (ch === "'" && (c === 0 || trimmed[c - 1] !== '\\')) {
              if (!inDQ && !inBT) inSQ = !inSQ;
            } else if (ch === '"' && (c === 0 || trimmed[c - 1] !== '\\')) {
              if (!inSQ && !inBT) inDQ = !inDQ;
            } else if (ch === '`' && (c === 0 || trimmed[c - 1] !== '\\')) {
              if (!inSQ && !inDQ) inBT = !inBT;
            } else if (ch === '/' && c + 1 < trimmed.length && trimmed[c + 1] === '/' && !inSQ && !inDQ && !inBT) {
              isComment = true;
              break;
            } else if (!/\s/.test(ch)) {
              codeBefore = true;
            }
          }

          if (isComment && codeBefore) {
            codeLines++;
            mixedLines++;
            continue;
          } else if (isComment && !codeBefore) {
            commentLines++;
            continue;
          }
        }

        codeLines++;
        continue;
      }

      // 6. Shell / Ruby / YAML (single line #)
      if (lang === 'shell' || lang === 'ruby' || lang === 'yaml') {
        if (trimmed.startsWith('#')) {
          commentLines++;
        } else if (trimmed.includes('#')) {
          codeLines++;
          mixedLines++;
        } else {
          codeLines++;
        }
        continue;
      }

      // Default: count non-empty as code
      codeLines++;
    }

    return {
      totalLines,
      codeLines,
      blankLines,
      commentLines,
      mixedLines,
    };
  }

  /**
   * AST-based cyclomatic complexity and function extraction for JavaScript and TypeScript.
   */
  public analyzeJsTsComplexity(
    filePath: string,
    content: string
  ): FileComplexityMetric {
    const ext = path.extname(filePath).toLowerCase();
    let scriptKind = ts.ScriptKind.TS;
    if (ext === '.tsx') scriptKind = ts.ScriptKind.TSX;
    else if (ext === '.jsx') scriptKind = ts.ScriptKind.JSX;
    else if (ext === '.js' || ext === '.mjs' || ext === '.cjs') scriptKind = ts.ScriptKind.JS;

    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
      );
    } catch {
      return {
        path: filePath,
        complexity: 1,
        functionsCount: 0,
        classesCount: 0,
        averageComplexityPerFunction: 1,
        status: 'measured',
        functions: [],
      };
    }

    const functions: Array<{ name: string; line: number; cyclomaticComplexity: number }> = [];
    let classesCount = 0;
    let moduleLevelDecisions = 0;

    const isFunctionNode = (node: ts.Node): boolean => {
      return (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessor(node) ||
        ts.isSetAccessor(node)
      );
    };

    const getFunctionName = (node: ts.Node): string => {
      if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
      if (ts.isMethodDeclaration(node) && node.name) return node.name.getText(sourceFile);
      if (ts.isConstructorDeclaration(node)) return 'constructor';
      if (ts.isGetAccessor(node) && node.name) return `get ${node.name.getText(sourceFile)}`;
      if (ts.isSetAccessor(node) && node.name) return `set ${node.name.getText(sourceFile)}`;

      // Check parent assignment or variable declaration
      const parent = node.parent;
      if (parent && ts.isVariableDeclaration(parent) && parent.name) {
        return parent.name.getText(sourceFile);
      }
      if (parent && ts.isPropertyAssignment(parent) && parent.name) {
        return parent.name.getText(sourceFile);
      }
      if (parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return parent.left.getText(sourceFile);
      }

      return 'anonymous';
    };

    const countDecisionPoints = (node: ts.Node): number => {
      let decisions = 0;

      const visit = (child: ts.Node) => {
        // Do not traverse into nested functions (they will be analyzed separately)
        if (child !== node && isFunctionNode(child)) {
          return;
        }

        switch (child.kind) {
          case ts.SyntaxKind.IfStatement:
          case ts.SyntaxKind.ConditionalExpression:
          case ts.SyntaxKind.ForStatement:
          case ts.SyntaxKind.ForInStatement:
          case ts.SyntaxKind.ForOfStatement:
          case ts.SyntaxKind.WhileStatement:
          case ts.SyntaxKind.DoStatement:
          case ts.SyntaxKind.CaseClause:
          case ts.SyntaxKind.CatchClause:
            decisions++;
            break;
          case ts.SyntaxKind.BinaryExpression: {
            const bin = child as ts.BinaryExpression;
            if (
              bin.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              bin.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              bin.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
            ) {
              decisions++;
            }
            break;
          }
        }

        ts.forEachChild(child, visit);
      };

      ts.forEachChild(node, visit);
      return decisions;
    };

    const walk = (node: ts.Node, inFunctionScope: boolean) => {
      if (
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isInterfaceDeclaration(node)
      ) {
        classesCount++;
      }

      if (isFunctionNode(node)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const name = getFunctionName(node);
        const decisions = countDecisionPoints(node);
        const complexity = 1 + decisions;

        functions.push({
          name,
          line,
          cyclomaticComplexity: complexity,
        });

        // Traverse children to find nested functions
        ts.forEachChild(node, (child) => walk(child, true));
        return;
      }

      // If outside any function scope, count module-level control flow
      if (!inFunctionScope) {
        switch (node.kind) {
          case ts.SyntaxKind.IfStatement:
          case ts.SyntaxKind.ConditionalExpression:
          case ts.SyntaxKind.ForStatement:
          case ts.SyntaxKind.ForInStatement:
          case ts.SyntaxKind.ForOfStatement:
          case ts.SyntaxKind.WhileStatement:
          case ts.SyntaxKind.DoStatement:
          case ts.SyntaxKind.CaseClause:
          case ts.SyntaxKind.CatchClause:
            moduleLevelDecisions++;
            break;
          case ts.SyntaxKind.BinaryExpression: {
            const bin = node as ts.BinaryExpression;
            if (
              bin.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              bin.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              bin.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
            ) {
              moduleLevelDecisions++;
            }
            break;
          }
        }
      }

      ts.forEachChild(node, (child) => walk(child, inFunctionScope));
    };

    walk(sourceFile, false);

    const totalFunctionComplexity = functions.reduce((sum, f) => sum + f.cyclomaticComplexity, 0);
    // Base complexity for a file is 1 + module decisions + function decision contributions
    const overallComplexity = Math.max(1, totalFunctionComplexity + moduleLevelDecisions);
    const avgPerFunction = functions.length > 0
      ? Number((totalFunctionComplexity / functions.length).toFixed(2))
      : 1;

    return {
      path: filePath,
      complexity: overallComplexity,
      functionsCount: functions.length,
      classesCount,
      averageComplexityPerFunction: avgPerFunction,
      status: 'measured',
      functions: functions.slice(0, 15),
    };
  }

  /**
   * AST-based cyclomatic complexity and structure extraction for Python.
   */
  public analyzePythonComplexity(
    pythonFiles: Map<string, string>
  ): Map<string, FileComplexityMetric> {
    const results = new Map<string, FileComplexityMetric>();
    if (pythonFiles.size === 0) return results;

    const BATCH_SCRIPT = `
import sys, json, ast

batch = json.loads(sys.stdin.read())
results = {}

for item in batch:
    path = item['path']
    src = item['content']
    try:
        tree = ast.parse(src)
        classes_count = 0
        functions = []
        module_decisions = 0

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                classes_count += 1

        class ComplexityVisitor(ast.NodeVisitor):
            def __init__(self):
                self.decisions = 0

            def visit_If(self, node):
                self.decisions += 1
                self.generic_visit(node)

            def visit_IfExp(self, node):
                self.decisions += 1
                self.generic_visit(node)

            def visit_For(self, node):
                self.decisions += 1
                self.generic_visit(node)

            def visit_AsyncFor(self, node):
                self.decisions += 1
                self.generic_visit(node)

            def visit_While(self, node):
                self.decisions += 1
                self.generic_visit(node)

            def visit_ExceptHandler(self, node):
                self.decisions += 1
                self.generic_visit(node)

            def visit_BoolOp(self, node):
                self.decisions += max(0, len(node.values) - 1)
                self.generic_visit(node)

            def visit_comprehension(self, node):
                self.decisions += 1 + len(node.ifs)
                self.generic_visit(node)

        # Measure top-level and method definitions
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                visitor = ComplexityVisitor()
                for body_item in node.body:
                    visitor.visit(body_item)
                func_complexity = 1 + visitor.decisions
                functions.append({
                    'name': node.name,
                    'line': getattr(node, 'lineno', 1),
                    'cyclomaticComplexity': func_complexity
                })

        total_func_comp = sum(f['cyclomaticComplexity'] for f in functions)
        overall = max(1, total_func_comp)
        avg = round(total_func_comp / len(functions), 2) if functions else 1

        results[path] = {
            'path': path,
            'complexity': overall,
            'functionsCount': len(functions),
            'classesCount': classes_count,
            'averageComplexityPerFunction': avg,
            'status': 'measured',
            'functions': functions[:15]
        }
    except Exception as e:
        results[path] = {
            'path': path,
            'complexity': 1,
            'functionsCount': 0,
            'classesCount': 0,
            'averageComplexityPerFunction': 1,
            'status': 'measured',
            'functions': []
        }

print(json.dumps(results))
`;

    try {
      const batchInput = Array.from(pythonFiles.entries()).map(([path, content]) => ({
        path,
        content,
      }));

      const raw = execFileSync('python3', ['-c', BATCH_SCRIPT], {
        input: JSON.stringify(batchInput),
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      });

      const parsed = JSON.parse(raw) as Record<string, FileComplexityMetric>;
      for (const [p, metric] of Object.entries(parsed)) {
        results.set(p, metric);
      }
      return results;
    } catch {
      // Pure JS fallback token scan for Python
      for (const [filePath, content] of pythonFiles.entries()) {
        results.set(filePath, this.fallbackPythonComplexity(filePath, content));
      }
      return results;
    }
  }

  private fallbackPythonComplexity(filePath: string, content: string): FileComplexityMetric {
    const lines = content.split(/\r?\n/);
    let classesCount = 0;
    const functions: Array<{ name: string; line: number; cyclomaticComplexity: number }> = [];

    let currentFunction: { name: string; line: number; decisions: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.length === 0) continue;

      if (/^class\s+\w+/i.test(trimmed)) {
        classesCount++;
      }

      const funcMatch = /^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/i.exec(trimmed);
      if (funcMatch) {
        if (currentFunction) {
          functions.push({
            name: currentFunction.name,
            line: currentFunction.line,
            cyclomaticComplexity: 1 + currentFunction.decisions,
          });
        }
        currentFunction = {
          name: funcMatch[1],
          line: i + 1,
          decisions: 0,
        };
        continue;
      }

      if (currentFunction) {
        if (/\b(if|elif|for|while|except)\b/.test(trimmed)) {
          currentFunction.decisions++;
        }
        if (/\b(and|or)\b/.test(trimmed)) {
          currentFunction.decisions++;
        }
      }
    }

    if (currentFunction) {
      functions.push({
        name: currentFunction.name,
        line: currentFunction.line,
        cyclomaticComplexity: 1 + currentFunction.decisions,
      });
    }

    const totalFuncComp = functions.reduce((sum, f) => sum + f.cyclomaticComplexity, 0);
    const overall = Math.max(1, totalFuncComp);
    const avg = functions.length > 0 ? Number((totalFuncComp / functions.length).toFixed(2)) : 1;

    return {
      path: filePath,
      complexity: overall,
      functionsCount: functions.length,
      classesCount,
      averageComplexityPerFunction: avg,
      status: 'measured',
      functions: functions.slice(0, 15),
    };
  }

  /**
   * Syntactic complexity extraction for Java.
   */
  public analyzeJavaComplexity(filePath: string, content: string): FileComplexityMetric {
    const lines = content.split(/\r?\n/);
    let classesCount = 0;
    const functions: Array<{ name: string; line: number; cyclomaticComplexity: number }> = [];

    let currentMethod: { name: string; line: number; decisions: number } | null = null;
    let braceDepth = 0;
    let methodDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.length === 0) continue;

      if (/\b(class|interface|enum)\s+\w+/.test(trimmed)) {
        classesCount++;
      }

      // Check method header
      const methodMatch = /(?:public|protected|private|static|\s)+[\w<>\[\]]+\s+([a-zA-Z0-9_]+)\s*\([^\)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{?/.exec(trimmed);
      if (methodMatch && !trimmed.startsWith('new ') && !trimmed.startsWith('return ')) {
        const name = methodMatch[1];
        if (name !== 'if' && name !== 'for' && name !== 'while' && name !== 'catch' && name !== 'switch') {
          if (currentMethod) {
            functions.push({
              name: currentMethod.name,
              line: currentMethod.line,
              cyclomaticComplexity: 1 + currentMethod.decisions,
            });
          }
          currentMethod = {
            name,
            line: i + 1,
            decisions: 0,
          };
          methodDepth = braceDepth;
        }
      }

      if (trimmed.includes('{')) braceDepth += (trimmed.match(/\{/g) || []).length;
      if (trimmed.includes('}')) braceDepth -= (trimmed.match(/\}/g) || []).length;

      if (currentMethod) {
        if (/\b(if|for|while|case|catch)\b/.test(trimmed)) {
          currentMethod.decisions++;
        }
        if (/&&|\|\||\?/.test(trimmed)) {
          currentMethod.decisions++;
        }

        if (braceDepth <= methodDepth && trimmed.includes('}')) {
          functions.push({
            name: currentMethod.name,
            line: currentMethod.line,
            cyclomaticComplexity: 1 + currentMethod.decisions,
          });
          currentMethod = null;
        }
      }
    }

    if (currentMethod) {
      functions.push({
        name: currentMethod.name,
        line: currentMethod.line,
        cyclomaticComplexity: 1 + currentMethod.decisions,
      });
    }

    const totalMethodComp = functions.reduce((sum, f) => sum + f.cyclomaticComplexity, 0);
    const overall = Math.max(1, totalMethodComp);
    const avg = functions.length > 0 ? Number((totalMethodComp / functions.length).toFixed(2)) : 1;

    return {
      path: filePath,
      complexity: overall,
      functionsCount: functions.length,
      classesCount,
      averageComplexityPerFunction: avg,
      status: 'measured',
      functions: functions.slice(0, 15),
    };
  }

  /**
   * Distinguishes test files, test cases, test frameworks, and coverage report presence.
   */
  public analyzeTestIntelligence(files: Map<string, string>): TestIntelligenceMetrics {
    const testFiles: Array<{
      path: string;
      testCasesCount: number;
      framework: string;
    }> = [];
    const frameworksSet = new Set<string>();
    let totalTestCases = 0;

    // Detect test runner / framework from configuration files
    for (const [p, content] of files.entries()) {
      const lower = p.toLowerCase();
      if (lower.includes('jest.config') || lower.includes('"jest"') && lower.endsWith('package.json')) {
        frameworksSet.add('Jest');
      }
      if (lower.includes('vitest.config')) {
        frameworksSet.add('Vitest');
      }
      if (lower.includes('pytest.ini') || (lower.includes('pyproject.toml') && content.includes('[tool.pytest'))) {
        frameworksSet.add('Pytest');
      }
      if (lower.includes('mocha') || content.includes('mocha')) {
        if (lower.endsWith('package.json')) frameworksSet.add('Mocha');
      }
    }

    const isTestFile = (p: string): boolean => {
      const lower = p.toLowerCase();
      // Recognized test directories
      const inTestDir = /(^|\/)(tests?|__tests__|spec|specs|testing)\//i.test(lower);
      // Naming conventions
      const isTestFilename =
        /\.(test|spec)\.[a-z0-9]+$/i.test(lower) ||
        /(^|\/)test_[^/]+\.py$/i.test(lower) ||
        /(^|\/)[^/]+_test\.py$/i.test(lower) ||
        /(^|\/)[^/]+(Test|Tests|TestCase)\.java$/i.test(lower) ||
        /(^|\/)test-[^/]+\.[a-z0-9]+$/i.test(lower) ||
        /(^|\/)[^/]+-test\.[a-z0-9]+$/i.test(lower);

      return inTestDir || isTestFilename;
    };

    for (const [filePath, content] of files.entries()) {
      if (!isTestFile(filePath)) continue;

      let fileFramework = 'Unknown Test Runner';
      let casesCount = 0;
      const lang = this.detectLanguage(filePath);

      if (lang === 'typescript' || lang === 'typescript-react' || lang === 'javascript' || lang === 'javascript-react') {
        // Detect framework from imports
        if (content.includes('vitest')) {
          fileFramework = 'Vitest';
          frameworksSet.add('Vitest');
        } else if (content.includes('@jest') || content.includes('jest.')) {
          fileFramework = 'Jest';
          frameworksSet.add('Jest');
        } else if (content.includes('mocha') || content.includes('chai') || content.includes('describe(')) {
          fileFramework = 'Mocha / Chai';
          frameworksSet.add('Mocha / Chai');
        } else if (content.includes('supertest')) {
          fileFramework = 'Supertest';
          frameworksSet.add('Supertest');
        }

        // Count test cases: it(), test(), fit(), xit(), it.only(), etc.
        const testCaseRegex = /\b(it|test|fit|xit)\s*(?:\.(?:only|skip|todo|concurrent))?\s*\(\s*(['"`])/g;
        const matches = content.match(testCaseRegex);
        casesCount = matches ? matches.length : 0;
      } else if (lang === 'python') {
        if (content.includes('import pytest') || content.includes('from pytest')) {
          fileFramework = 'Pytest';
          frameworksSet.add('Pytest');
        } else if (content.includes('import unittest') || content.includes('from unittest')) {
          fileFramework = 'unittest';
          frameworksSet.add('unittest');
        } else {
          fileFramework = 'Pytest / unittest';
          frameworksSet.add('Pytest / unittest');
        }

        // Count test cases: def test_...
        const pyMatches = content.match(/def\s+test_[a-zA-Z0-9_]+\s*\(/g);
        casesCount = pyMatches ? pyMatches.length : 0;
      } else if (lang === 'java') {
        if (content.includes('org.junit')) {
          fileFramework = 'JUnit';
          frameworksSet.add('JUnit');
        } else if (content.includes('org.testng')) {
          fileFramework = 'TestNG';
          frameworksSet.add('TestNG');
        }

        const javaMatches = content.match(/@(Test|ParameterizedTest)\b|public\s+void\s+test[a-zA-Z0-9_]*\s*\(/g);
        casesCount = javaMatches ? javaMatches.length : 0;
      }

      totalTestCases += casesCount;
      testFiles.push({
        path: filePath,
        testCasesCount: casesCount,
        framework: fileFramework,
      });
    }

    // Check for actual coverage report files in the repository source
    let coverageAvailable = false;
    let coveragePct: number | null = null;
    let reportFormat: string | undefined = undefined;

    for (const [p, content] of files.entries()) {
      const lower = p.toLowerCase();
      if (lower.endsWith('lcov.info')) {
        coverageAvailable = true;
        reportFormat = 'lcov';
        // Extract LF / LH (Lines Found / Lines Hit)
        const lfMatches: string[] = content.match(/LF:(\d+)/g) || [];
        const lhMatches: string[] = content.match(/LH:(\d+)/g) || [];
        const lf = lfMatches.reduce<number>((sum, m) => sum + parseInt(m.replace('LF:', ''), 10), 0);
        const lh = lhMatches.reduce<number>((sum, m) => sum + parseInt(m.replace('LH:', ''), 10), 0);
        if (lf > 0) {
          coveragePct = Number(((lh / lf) * 100).toFixed(1));
        }
        break;
      }
      if (lower.endsWith('coverage-final.json') || lower.endsWith('coverage-summary.json')) {
        coverageAvailable = true;
        reportFormat = 'istanbul-json';
        try {
          const parsed = JSON.parse(content);
          if (parsed.total?.lines?.pct !== undefined) {
            coveragePct = Number(parsed.total.lines.pct);
          }
        } catch {
          // invalid json
        }
        break;
      }
    }

    return {
      testFilesDetected: testFiles.length,
      testCasesDetected: totalTestCases,
      testFrameworks: Array.from(frameworksSet),
      testFiles: testFiles.slice(0, 20),
      executionStatus: 'not-executed',
      executionNotice:
        'Static analysis only: test suites are detected and indexed from source code, but not executed in this sandbox environment.',
      coverage: {
        available: coverageAvailable,
        percentage: coveragePct,
        reason: coverageAvailable
          ? `Parsed from ${reportFormat} report found in repository.`
          : 'No test coverage report (e.g., lcov.info, coverage-summary.json, cobertura.xml) found in repository source tree.',
        reportFormat,
      },
    };
  }

  /**
   * Main metrics pipeline: produces measurable, repository-aware code intelligence.
   */
  public computeRepositoryMetrics(
    files: Map<string, string>,
    metadata?: RepoMetadata
  ): RepositoryMetrics {
    const fileMetrics: FileLineMetrics[] = [];
    const languageTotals: Record<
      string,
      { files: number; total: number; code: number; blank: number; comment: number }
    > = {};

    const pythonFiles = new Map<string, string>();
    const complexFiles: FileComplexityMetric[] = [];
    const unsupportedFiles: string[] = [];

    // 1. Compute Language-Aware Lines of Code (LOC) for every non-binary file
    for (const [filePath, content] of files.entries()) {
      const language = this.detectLanguage(filePath);
      const lineStats = this.analyzeFileLines(filePath, content, language);

      let isComplexitySupported = false;
      if (
        language === 'typescript' ||
        language === 'typescript-react' ||
        language === 'javascript' ||
        language === 'javascript-react' ||
        language === 'python' ||
        language === 'java'
      ) {
        isComplexitySupported = true;
      }

      if (language === 'python') {
        pythonFiles.set(filePath, content);
      }

      if (!isComplexitySupported) {
        unsupportedFiles.push(filePath);
      }

      fileMetrics.push({
        filePath,
        language,
        totalLines: lineStats.totalLines,
        codeLines: lineStats.codeLines,
        blankLines: lineStats.blankLines,
        commentLines: lineStats.commentLines,
        mixedLines: lineStats.mixedLines,
        cyclomaticComplexity: null, // populated below for supported languages
        functionsCount: 0,
        classesCount: 0,
        complexityStatus: isComplexitySupported ? 'measured' : 'unavailable',
      });

      if (!languageTotals[language]) {
        languageTotals[language] = { files: 0, total: 0, code: 0, blank: 0, comment: 0 };
      }
      languageTotals[language].files++;
      languageTotals[language].total += lineStats.totalLines;
      languageTotals[language].code += lineStats.codeLines;
      languageTotals[language].blank += lineStats.blankLines;
      languageTotals[language].comment += lineStats.commentLines;
    }

    // 2. Measure Cyclomatic Complexity on Supported Languages
    // JS/TS via TypeScript AST
    for (const fm of fileMetrics) {
      if (
        fm.language === 'typescript' ||
        fm.language === 'typescript-react' ||
        fm.language === 'javascript' ||
        fm.language === 'javascript-react'
      ) {
        const content = files.get(fm.filePath) || '';
        const comp = this.analyzeJsTsComplexity(fm.filePath, content);
        fm.cyclomaticComplexity = comp.complexity;
        fm.functionsCount = comp.functionsCount;
        fm.classesCount = comp.classesCount;
        complexFiles.push(comp);
      } else if (fm.language === 'java') {
        const content = files.get(fm.filePath) || '';
        const comp = this.analyzeJavaComplexity(fm.filePath, content);
        fm.cyclomaticComplexity = comp.complexity;
        fm.functionsCount = comp.functionsCount;
        fm.classesCount = comp.classesCount;
        complexFiles.push(comp);
      }
    }

    // Python via Python AST
    if (pythonFiles.size > 0) {
      const pythonCompMap = this.analyzePythonComplexity(pythonFiles);
      for (const fm of fileMetrics) {
        if (fm.language === 'python') {
          const comp = pythonCompMap.get(fm.filePath);
          if (comp) {
            fm.cyclomaticComplexity = comp.complexity;
            fm.functionsCount = comp.functionsCount;
            fm.classesCount = comp.classesCount;
            complexFiles.push(comp);
          }
        }
      }
    }

    // 3. Aggregate Summary Totals
    let totalCodeLines = 0;
    let totalBlankLines = 0;
    let totalCommentLines = 0;
    let totalMixedLines = 0;
    let grandTotalLines = 0;

    for (const fm of fileMetrics) {
      totalCodeLines += fm.codeLines;
      totalBlankLines += fm.blankLines;
      totalCommentLines += fm.commentLines;
      totalMixedLines += fm.mixedLines;
      grandTotalLines += fm.totalLines;
    }

    // 4. Per-Language Distribution
    const languages: LanguageMetric[] = Object.entries(languageTotals)
      .map(([lang, totals]) => ({
        language: lang,
        filesCount: totals.files,
        totalLines: totals.total,
        codeLines: totals.code,
        blankLines: totals.blank,
        commentLines: totals.comment,
        percentage: totalCodeLines > 0 ? Number(((totals.code / totalCodeLines) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.codeLines - a.codeLines);

    // 5. Aggregate Complexity Metrics
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalCompSum = 0;
    let maxComplexityFile: { path: string; complexity: number } | null = null;
    const distribution = { low: 0, medium: 0, high: 0 };

    for (const cf of complexFiles) {
      totalFunctions += cf.functionsCount;
      totalClasses += cf.classesCount;
      totalCompSum += cf.complexity;

      if (!maxComplexityFile || cf.complexity > maxComplexityFile.complexity) {
        maxComplexityFile = { path: cf.path, complexity: cf.complexity };
      }

      // Standard McCabe distribution: Low <= 5, Medium 6-10, High > 10
      if (cf.complexity <= 5) distribution.low++;
      else if (cf.complexity <= 10) distribution.medium++;
      else distribution.high++;
    }

    const avgPerFile = complexFiles.length > 0 ? Number((totalCompSum / complexFiles.length).toFixed(1)) : 1;
    const avgPerFunction = totalFunctions > 0 ? Number((totalCompSum / totalFunctions).toFixed(1)) : 1;

    // Top 10 most complex files
    const topComplexFiles = [...complexFiles].sort((a, b) => b.complexity - a.complexity).slice(0, 10);

    const complexitySummary: ComplexityMetricsSummary = {
      status: complexFiles.length > 0 ? 'measured' : 'unavailable',
      measuredFilesCount: complexFiles.length,
      unsupportedFilesCount: unsupportedFiles.length,
      totalFunctionsCount: totalFunctions,
      totalClassesCount: totalClasses,
      averagePerFunction: avgPerFunction,
      averagePerFile: avgPerFile,
      maxComplexityFile,
      distribution,
      topComplexFiles,
    };

    // 6. Test Intelligence
    const testIntelligence = this.analyzeTestIntelligence(files);

    return {
      summary: {
        totalSourceFiles: fileMetrics.length,
        totalLines: grandTotalLines,
        codeLines: totalCodeLines,
        blankLines: totalBlankLines,
        commentLines: totalCommentLines,
        mixedLines: totalMixedLines,
        locProvenance: 'measured',
      },
      languages,
      complexity: complexitySummary,
      testIntelligence,
      partiallyAnalyzedOrUnsupported: {
        count: unsupportedFiles.length,
        files: unsupportedFiles.slice(0, 20),
        reason: 'Static cyclomatic complexity measurement is supported for JavaScript, TypeScript, Python, and Java source files. Other non-code or configuration formats (JSON, CSS, HTML, Markdown, YAML) are measured for LOC only.',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const codeMetricsService = new CodeMetricsService();
export default codeMetricsService;
