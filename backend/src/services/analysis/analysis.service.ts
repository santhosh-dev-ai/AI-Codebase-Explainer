import path from 'path';
import { sessionService } from '../storage/session.service';
import { promptBuilderService } from '../ai/prompt-builder.service';
import { openaiService } from '../ai/openai.service';
import logger from '../../utils/logger.util';
import type {
  ArchitectureOverview,
  AnalysisRisk,
  AnalysisScorecard,
  DeepDiveExplanation,
  EvidenceItem,
  KeyModule,
  FileExplanation,
  FunctionInfo,
  Bug,
} from '../../types/analysis.types';
import type { FileNode, RepoMetadata } from '../../types/repository.types';
import { detectLanguage } from '../../utils/file-processor.util';

export class AnalysisService {
  async generateOverview(sessionId: string): Promise<ArchitectureOverview | null> {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    const fileTree = this.renderTree(session.fileTree);
    const metadata = this.renderMetadata(session.metadata);
    const sampleFiles = this.pickRepresentativeFiles(session.files);

    const prompt = promptBuilderService.buildArchitectureAnalysisPrompt(
      fileTree,
      metadata,
      sampleFiles
    );

    let rawResponse = '';
    try {
      rawResponse = await openaiService.generateCompletion(
        prompt,
        'You are a senior software architect. Return strict JSON only.',
        { temperature: 0.2, maxTokens: 3800 }
      );
    } catch (error) {
      logger.warn('AI overview generation error, falling back to deterministic analysis', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const parsed = this.parseOverview(rawResponse);
    const enriched = this.enrichWithDeterministicSignals(
      parsed,
      session.metadata,
      session.files
    );

    logger.info('Architecture overview generated', {
      sessionId,
      responseLength: rawResponse.length,
      evidenceCount: enriched.evidence.length,
      riskCount: enriched.risks.length,
      confidence: enriched.confidence,
    });

    return enriched;
  }

  async explainFile(sessionId: string, filePath: string): Promise<FileExplanation | null> {
    const session = sessionService.getSession(sessionId);
    if (!session || !filePath) {
      return null;
    }

    const actualPath = sessionService.resolveFilePath(sessionId, filePath) || filePath;
    const fileContent = sessionService.getFileContent(sessionId, actualPath);
    if (fileContent === null) {
      return null;
    }

    const language = detectLanguage(actualPath);
    const deterministic = this.extractDeterministicFileInfo(actualPath, fileContent, language);

    try {
      const truncated =
        fileContent.length > 6000
          ? `${fileContent.substring(0, 6000)}\n// ... [remaining content truncated for analysis]`
          : fileContent;

      const prompt = promptBuilderService.buildFileExplanationPrompt(
        actualPath,
        truncated,
        language,
        session.metadata.name
      );

      const rawResponse = await openaiService.generateCompletion(
        prompt,
        'You are an expert code reviewer. Return strict JSON only.',
        { temperature: 0.2, maxTokens: 1800 }
      );

      const parsed = this.parseFileExplanation(rawResponse, actualPath, deterministic);
      logger.info('File explanation generated', {
        sessionId,
        filePath: actualPath,
        functionsCount: parsed.keyFunctions.length,
        complexity: parsed.complexity,
      });

      return parsed;
    } catch (error) {
      logger.warn('AI file explanation generation error, using deterministic analysis', {
        sessionId,
        filePath: actualPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return deterministic;
    }
  }

  private renderTree(nodes: FileNode[], level = 0): string {
    const lines: string[] = [];
    const maxLines = 1500;

    const walk = (tree: FileNode[], depth: number): void => {
      for (const node of tree) {
        if (lines.length >= maxLines) {
          return;
        }

        const indent = '  '.repeat(depth);
        const marker = node.type === 'directory' ? '[D]' : '[F]';
        lines.push(`${indent}${marker} ${node.name}`);

        if (node.type === 'directory' && node.children?.length) {
          walk(node.children, depth + 1);
        }
      }
    };

    walk(nodes, level);
    return lines.join('\n');
  }

  private renderMetadata(metadata: RepoMetadata): string {
    const topLanguages = Object.entries(metadata.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([lang, count]) => `${lang}: ${count}`)
      .join(', ');

    const topFileTypes = Object.entries(metadata.fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([ext, count]) => `${ext}: ${count}`)
      .join(', ');

    return [
      `Repository: ${metadata.name}`,
      `Total files: ${metadata.totalFiles}`,
      `Total size(bytes): ${metadata.totalSize}`,
      `Tree depth: ${metadata.depth}`,
      `Top languages: ${topLanguages}`,
      `Top file types: ${topFileTypes}`,
    ].join('\n');
  }

  private pickRepresentativeFiles(files: Map<string, string>): Record<string, string> {
    const entries = Array.from(files.entries());
    const maxSamples = 24;

    const priorityPatterns = [
      /readme/i,
      /package\.json$/,
      /requirements\.txt$/,
      /pyproject\.toml$/,
      /pom\.xml$/,
      /go\.mod$/,
      /cargo\.toml$/,
      /dockerfile/i,
      /compose\.ya?ml$/,
      /src\/app\./,
      /src\/main\./,
      /server\./,
      /index\.(ts|tsx|js|jsx|py|go|rs)$/,
      /controller/i,
      /route/i,
      /service/i,
      /model/i,
      /schema/i,
      /config/i,
    ];

    const scored = entries.map(([filePath, content]) => {
      let score = 0;
      const normalized = filePath.toLowerCase();

      for (const pattern of priorityPatterns) {
        if (pattern.test(normalized)) {
          score += 8;
        }
      }

      const ext = path.extname(normalized);
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs'].includes(ext)) {
        score += 5;
      }

      if (normalized.includes('/src/')) {
        score += 3;
      }

      const size = Buffer.byteLength(content, 'utf8');
      if (size > 200 && size < 80_000) {
        score += 2;
      }

      return { filePath, content, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const selected: Record<string, string> = {};
    for (const item of scored.slice(0, 16)) {
      selected[item.filePath] = item.content.substring(0, 1500);
    }

    return selected;
  }

  private extractJson(raw: string): string {
    const fencedJson = raw.match(/```json\s*([\s\S]*?)```/i);
    if (fencedJson?.[1]) {
      return fencedJson[1].trim();
    }

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return raw.slice(start, end + 1);
    }

    return raw.trim();
  }

  private parseOverview(raw: string): ArchitectureOverview {
    const fallback: ArchitectureOverview = {
      summary: 'Overview could not be parsed from model output.',
      executiveBullets: [],
      pattern: 'Unknown',
      techStack: [],
      projectType: 'other',
      framework: undefined,
      keyModules: [],
      dataFlow: 'Insufficient data to determine data flow.',
      deepDive: {
        architectureNarrative: 'Not available.',
        runtimeFlow: 'Not available.',
        dataLifecycle: 'Not available.',
        qualitySignals: 'Not available.',
        scalabilityAndOps: 'Not available.',
        recommendations: 'Not available.',
      },
      scorecard: {
        architecture: 50,
        maintainability: 50,
        complexity: 50,
        reliability: 50,
        security: 50,
      },
      detectedEntryPoints: [],
      integrationPoints: [],
      risks: [],
      evidence: [],
      confidence: 35,
      unknowns: ['Model output was not valid JSON'],
    };

    try {
      const json = this.extractJson(raw);
      const parsed = JSON.parse(json) as Partial<ArchitectureOverview> & {
        keyModules?: Partial<KeyModule>[];
        risks?: Partial<AnalysisRisk>[];
        evidence?: Partial<EvidenceItem>[];
      };

      const keyModules = (parsed.keyModules || [])
        .filter((m) => m && (m.name || m.path || m.responsibility))
        .slice(0, 12)
        .map((m) => ({
          name: (m.name || 'Unnamed module').trim(),
          path: (m.path || 'unknown').trim(),
          responsibility: (m.responsibility || 'Responsibility not specified').trim(),
        }));

      const risks = (parsed.risks || [])
        .filter((r) => r && (r.title || r.detail))
        .slice(0, 12)
        .map((r) => {
          const severity = String(r.severity || 'medium').toLowerCase();
          const basePercentage = severity === 'high' ? 75 : severity === 'medium' ? 45 : 20;
          const randomOffset = Math.floor(Math.random() * 15); // Add variance
          return {
            title: (r.title || 'Risk').trim(),
            severity: severity === 'high' || severity === 'medium' || severity === 'low'
              ? severity
              : 'medium',
            detail: (r.detail || 'No details provided').trim(),
            mitigation: (r.mitigation || 'No mitigation provided').trim(),
            percentage: typeof r.percentage === 'number' ? r.percentage : (basePercentage + randomOffset),
            category: r.category || (severity === 'high' ? 'Security' : severity === 'medium' ? 'Maintainability' : 'Reliability'),
          } as AnalysisRisk;
        });

      const evidence = (parsed.evidence || [])
        .filter((e) => e && (e.filePath || e.finding || e.relevance))
        .slice(0, 20)
        .map((e) => ({
          filePath: (e.filePath || 'unknown').trim(),
          finding: (e.finding || 'No finding provided').trim(),
          relevance: (e.relevance || 'No relevance provided').trim(),
        }));

      const confidenceValue = Number(parsed.confidence);
      const confidence = Number.isFinite(confidenceValue)
        ? Math.max(0, Math.min(100, Math.round(confidenceValue)))
        : 50;

      const deepDive = this.parseDeepDive(parsed.deepDive);
      const scorecard = this.parseScorecard(parsed.scorecard);

      return {
        summary: String(parsed.summary || fallback.summary).trim(),
        executiveBullets: Array.isArray(parsed.executiveBullets)
          ? parsed.executiveBullets.map((item) => String(item).trim()).filter(Boolean).slice(0, 16)
          : [],
        pattern: String(parsed.pattern || 'Unknown').trim(),
        techStack: Array.isArray(parsed.techStack)
          ? parsed.techStack.map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
          : [],
        projectType: String(parsed.projectType || 'other').trim(),
        framework: parsed.framework ? String(parsed.framework).trim() : undefined,
        keyModules,
        dataFlow: String(parsed.dataFlow || fallback.dataFlow).trim(),
        deepDive,
        scorecard,
        detectedEntryPoints: Array.isArray(parsed.detectedEntryPoints)
          ? parsed.detectedEntryPoints.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
          : [],
        integrationPoints: Array.isArray(parsed.integrationPoints)
          ? parsed.integrationPoints.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
          : [],
        risks,
        evidence,
        confidence,
        unknowns: Array.isArray(parsed.unknowns)
          ? parsed.unknowns.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
          : [],
      };
    } catch (error) {
      logger.warn('Failed to parse architecture overview JSON', {
        error: error instanceof Error ? error.message : 'Unknown parse error',
      });
      return fallback;
    }
  }

  private parseDeepDive(input: unknown): DeepDiveExplanation {
    const source = (input && typeof input === 'object' ? input : {}) as Partial<DeepDiveExplanation>;
    return {
      architectureNarrative: String(source.architectureNarrative || 'Not available.').trim(),
      runtimeFlow: String(source.runtimeFlow || 'Not available.').trim(),
      dataLifecycle: String(source.dataLifecycle || 'Not available.').trim(),
      qualitySignals: String(source.qualitySignals || 'Not available.').trim(),
      scalabilityAndOps: String(source.scalabilityAndOps || 'Not available.').trim(),
      recommendations: String(source.recommendations || 'Not available.').trim(),
    };
  }

  private parseScorecard(input: unknown): AnalysisScorecard {
    const source = (input && typeof input === 'object' ? input : {}) as Partial<AnalysisScorecard>;

    const normalize = (value: unknown, fallback: number) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return fallback;
      return Math.max(0, Math.min(100, Math.round(num)));
    };

    return {
      architecture: normalize(source.architecture, 55),
      maintainability: normalize(source.maintainability, 55),
      complexity: normalize(source.complexity, 50),
      reliability: normalize(source.reliability, 55),
      security: normalize(source.security, 50),
    };
  }

  private enrichWithDeterministicSignals(
    overview: ArchitectureOverview,
    metadata: RepoMetadata,
    files: Map<string, string>
  ): ArchitectureOverview {
    const inferredTech = this.inferTechStack(files, metadata);
    const inferredEntries = this.inferEntryPoints(files);

    const techStack = Array.from(new Set([...overview.techStack, ...inferredTech])).slice(0, 30);
    const detectedEntryPoints = Array.from(
      new Set([...overview.detectedEntryPoints, ...inferredEntries])
    ).slice(0, 20);

    const riskPenalty = Math.min(25, (overview.risks?.length || 0) * 3);
    const baseMaintainability = Math.max(35, 72 - riskPenalty);

    const scorecard: AnalysisScorecard = {
      architecture: this.coerceScore(overview.scorecard?.architecture, 70),
      maintainability: this.coerceScore(overview.scorecard?.maintainability, baseMaintainability),
      complexity: this.coerceScore(overview.scorecard?.complexity, 60),
      reliability: this.coerceScore(overview.scorecard?.reliability, 68 - Math.floor(riskPenalty / 2)),
      security: this.coerceScore(overview.scorecard?.security, 62 - Math.floor(riskPenalty / 3)),
    };

    return {
      ...overview,
      techStack,
      detectedEntryPoints,
      scorecard,
    };
  }

  private coerceScore(value: number | undefined, fallback: number): number {
    const target = Number.isFinite(Number(value)) ? Number(value) : fallback;
    return Math.max(0, Math.min(100, Math.round(target)));
  }

  private inferTechStack(files: Map<string, string>, metadata: RepoMetadata): string[] {
    const inferred = new Set<string>();

    for (const language of Object.keys(metadata.languages)) {
      inferred.add(language);
    }

    for (const filePath of files.keys()) {
      const normalized = filePath.toLowerCase();
      if (normalized.endsWith('package.json')) inferred.add('node.js');
      if (normalized.endsWith('tsconfig.json')) inferred.add('typescript');
      if (normalized.includes('next.config')) inferred.add('next.js');
      if (normalized.includes('vite.config')) inferred.add('vite');
      if (normalized.endsWith('requirements.txt')) inferred.add('python');
      if (normalized.endsWith('pyproject.toml')) inferred.add('python');
      if (normalized.endsWith('dockerfile') || normalized.includes('docker-compose')) {
        inferred.add('docker');
      }
    }

    return Array.from(inferred)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private inferEntryPoints(files: Map<string, string>): string[] {
    const candidates: string[] = [];
    const patterns = [
      /(^|\/)src\/main\./i,
      /(^|\/)src\/app\./i,
      /(^|\/)main\.(ts|tsx|js|jsx|py|go|rs|java)$/i,
      /(^|\/)index\.(ts|tsx|js|jsx|py|go|rs|java)$/i,
      /(^|\/)server\.(ts|js)$/i,
      /(^|\/)app\.(ts|tsx|js|jsx|py)$/i,
      /(^|\/)cmd\//i,
      /(^|\/)routes?\//i,
    ];

    for (const filePath of files.keys()) {
      if (patterns.some((pattern) => pattern.test(filePath))) {
        candidates.push(filePath);
      }
    }

    return candidates.slice(0, 20);
  }

  private extractDeterministicFileInfo(
    filePath: string,
    content: string,
    language: string
  ): FileExplanation {
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Detect dependencies/imports
    const dependencies: string[] = [];
    const jsImportRegex = /(?:import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]+\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    let match: RegExpExecArray | null;
    while ((match = jsImportRegex.exec(content)) !== null) {
      const dep = match[1] || match[2];
      if (dep && !dependencies.includes(dep)) {
        dependencies.push(dep);
      }
    }

    const pyImportRegex = /^(?:from\s+(\S+)\s+)?import\s+([^\n#]+)/gm;
    while ((match = pyImportRegex.exec(content)) !== null) {
      const dep = (match[1] || match[2]).trim().split(/\s*,\s*/)[0];
      if (dep && !dependencies.includes(dep)) {
        dependencies.push(dep);
      }
    }

    // Detect exports
    const exportsList: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1] && !exportsList.includes(match[1])) {
        exportsList.push(match[1]);
      }
    }

    // Detect functions/methods
    const keyFunctions: FunctionInfo[] = [];
    const funcRegex =
      /^(?:\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)|\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?:=>|:)|\s*(?:public|private|protected|async|\*)*\s*(\w+)\s*\([^)]*\)\s*\{|\s*def\s+(\w+)\s*\([^)]*\):)/gm;

    lines.forEach((line, index) => {
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = funcRegex.exec(line)) !== null) {
        const name = lineMatch[1] || lineMatch[2] || lineMatch[3] || lineMatch[4];
        if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name) && keyFunctions.length < 15) {
          keyFunctions.push({
            name,
            lineStart: index + 1,
            lineEnd: Math.min(index + 20, totalLines),
            description: `Function ${name} handling operations in ${path.basename(filePath)}.`,
            parameters: [],
            returns: 'unknown',
          });
        }
      }
    });

    const complexity: 'low' | 'medium' | 'high' =
      totalLines > 350 || keyFunctions.length > 12
        ? 'high'
        : totalLines > 100 || keyFunctions.length > 5
        ? 'medium'
        : 'low';

    const fileName = path.basename(filePath);
    const patterns = [
      `${language.toUpperCase()} module implementation`,
      `Modular organization with ${keyFunctions.length} primary function(s)`,
    ];

    if (dependencies.length > 0) {
      patterns.push(`External dependencies integration (${dependencies.slice(0, 3).join(', ')})`);
    }

    return {
      filePath,
      purpose: `Provides core logic and services for ${fileName} in the project structure.`,
      keyFunctions,
      dependencies: dependencies.slice(0, 15),
      exports: exportsList.slice(0, 15),
      patterns: patterns.slice(0, 4),
      complexity,
    };
  }

  private parseFileExplanation(
    raw: string,
    filePath: string,
    fallback: FileExplanation
  ): FileExplanation {
    try {
      const json = this.extractJson(raw);
      const parsed = JSON.parse(json) as Partial<FileExplanation>;

      const complexityRaw = String(parsed.complexity || '').toLowerCase();
      const complexity =
        complexityRaw === 'low' || complexityRaw === 'medium' || complexityRaw === 'high'
          ? complexityRaw
          : fallback.complexity;

      const keyFunctions =
        Array.isArray(parsed.keyFunctions) && parsed.keyFunctions.length > 0
          ? parsed.keyFunctions.map((fn) => ({
              name: String(fn.name || 'anonymous').trim(),
              lineStart: Number(fn.lineStart) || 1,
              lineEnd: Number(fn.lineEnd) || 1,
              description: String(fn.description || 'No description provided').trim(),
              parameters: Array.isArray(fn.parameters) ? fn.parameters.map(String) : [],
              returns: String(fn.returns || 'void').trim(),
            }))
          : fallback.keyFunctions;

      const dependencies =
        Array.isArray(parsed.dependencies) && parsed.dependencies.length > 0
          ? parsed.dependencies.map(String).filter(Boolean)
          : fallback.dependencies;

      const exports =
        Array.isArray(parsed.exports) && parsed.exports.length > 0
          ? parsed.exports.map(String).filter(Boolean)
          : fallback.exports;

      const patterns =
        Array.isArray(parsed.patterns) && parsed.patterns.length > 0
          ? parsed.patterns.map(String).filter(Boolean)
          : fallback.patterns;

      return {
        filePath,
        purpose: String(parsed.purpose || fallback.purpose).trim(),
        keyFunctions,
        dependencies,
        exports,
        patterns,
        complexity,
      };
    } catch {
      return fallback;
    }
  }

  async detectBugs(sessionId: string, filePath?: string): Promise<Bug[]> {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      return [];
    }

    const targetPath = filePath
      ? (sessionService.resolveFilePath(sessionId, filePath) || filePath)
      : Array.from(session.files.keys())[0];
    const fileContent = targetPath ? sessionService.getFileContent(sessionId, targetPath) : null;
    if (!targetPath || !fileContent) {
      return [];
    }

    const language = detectLanguage(targetPath);
    try {
      const truncated =
        fileContent.length > 5000
          ? `${fileContent.substring(0, 5000)}\n// ... [remaining content truncated]`
          : fileContent;

      const prompt = promptBuilderService.buildBugDetectionPrompt(targetPath, truncated, language);
      const rawResponse = await openaiService.generateCompletion(
        prompt,
        'You are a senior software quality engineer. Return strict JSON only.',
        { temperature: 0.2, maxTokens: 1800 }
      );

      const json = this.extractJson(rawResponse);
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          severity: (['critical', 'high', 'medium', 'low'].includes(item.severity)
            ? item.severity
            : 'medium') as Bug['severity'],
          type: String(item.type || 'Potential Bug'),
          line: Number(item.line) || 1,
          description: String(item.description || 'Potential issue detected'),
          suggestion: String(item.suggestion || 'Review logic and add safeguards'),
          codeSnippet: String(item.codeSnippet || ''),
        }));
      }
      return [];
    } catch (error) {
      logger.warn('AI bug detection failed, returning empty list', {
        sessionId,
        targetPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async getFlowDiagram(sessionId: string): Promise<{ mermaid: string; description: string }> {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      return {
        mermaid: 'graph TD\n  Client[Client] --> Server[Server]',
        description: 'Session unavailable',
      };
    }

    const sampleFiles = this.pickRepresentativeFiles(session.files);
    const fileTree = this.renderTree(session.fileTree);

    try {
      const prompt = promptBuilderService.buildFlowDiagramPrompt(
        fileTree,
        sampleFiles,
        session.metadata.name
      );

      const rawResponse = await openaiService.generateCompletion(
        prompt,
        'You are a software architect who creates accurate Mermaid diagrams.',
        { temperature: 0.2, maxTokens: 1200 }
      );

      const mermaidMatch = rawResponse.match(/```mermaid\s*([\s\S]*?)```/i);
      const mermaid = mermaidMatch ? mermaidMatch[1].trim() : rawResponse.trim();

      return {
        mermaid: mermaid.startsWith('graph') || mermaid.startsWith('flowchart')
          ? mermaid
          : `flowchart TD\n  Client[User/Client] --> App[Application: ${session.metadata.name}]\n  App --> Storage[Local Data/Files]`,
        description: `Architecture and control flow diagram for ${session.metadata.name}.`,
      };
    } catch (error) {
      logger.warn('AI flow diagram failed, generating deterministic diagram', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        mermaid: `flowchart TD\n  Client[User/Client] --> App[Application: ${session.metadata.name}]\n  App --> Storage[Local Data/Files]`,
        description: `High-level flow diagram for ${session.metadata.name}.`,
      };
    }
  }
}

export const analysisService = new AnalysisService();
