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
} from '../../types/analysis.types';
import type { FileNode, RepoMetadata } from '../../types/repository.types';

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

    const rawResponse = await openaiService.generateCompletion(
      prompt,
      'You are a senior software architect. Return strict JSON only.',
      { temperature: 0.2, maxTokens: 3800 }
    );

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
    for (const item of scored.slice(0, maxSamples)) {
      selected[item.filePath] = item.content.substring(0, 2400);
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
          return {
            title: (r.title || 'Risk').trim(),
            severity: severity === 'high' || severity === 'medium' || severity === 'low'
              ? severity
              : 'medium',
            detail: (r.detail || 'No details provided').trim(),
            mitigation: (r.mitigation || 'No mitigation provided').trim(),
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
}

export const analysisService = new AnalysisService();
