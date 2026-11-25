import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { sessionService } from '../storage/session.service';
import { promptBuilderService } from '../ai/prompt-builder.service';
import { openaiService } from '../ai/openai.service';
import { pythonDependencyService } from './python-dependency.service';
import { frameworkDetectionService } from './framework-detection.service';
import { architectureIntelligenceService } from './architecture-intelligence.service';
import { codeMetricsService } from './code-metrics.service';
import logger from '../../utils/logger.util';
import config from '../../config/env.config';
import { LruCache } from '../../utils/lru-cache.util';
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
  ExecutionFlowStep,
  ArchitectureLayer,
  DependencyGraphData,
  DependencyGraphNode,
  DependencyGraphEdge,
  DependencyNodeType,
  PythonDependencyDiagnostics,
  UnresolvedImportEntry,
  AmbiguousResolutionEntry,
} from '../../types/analysis.types';
import type { FileNode, RepoMetadata, SessionData } from '../../types/repository.types';
import { detectLanguage } from '../../utils/file-processor.util';

export const ANALYSIS_ENGINE_VERSION = '2.3.9';

export interface CacheMetrics {
  explanationHits: number;
  explanationMisses: number;
  explanationEvictions: number;
  overviewHits: number;
  overviewMisses: number;
  overviewEvictions: number;
  graphHits: number;
  graphMisses: number;
  graphEvictions: number;
  inFlightOverviewReused: number;
  aiCallsAvoided: number;
}

export class AnalysisService {
  private explanationCache: LruCache<string, FileExplanation>;
  private canonicalCache: LruCache<string, ArchitectureOverview>;
  private dependencyGraphCache: LruCache<string, DependencyGraphData>;
  private inFlightOverviews: Map<string, Promise<ArchitectureOverview | null>> = new Map();

  private metrics: CacheMetrics = {
    explanationHits: 0,
    explanationMisses: 0,
    explanationEvictions: 0,
    overviewHits: 0,
    overviewMisses: 0,
    overviewEvictions: 0,
    graphHits: 0,
    graphMisses: 0,
    graphEvictions: 0,
    inFlightOverviewReused: 0,
    aiCallsAvoided: 0,
  };

  constructor() {
    this.explanationCache = new LruCache<string, FileExplanation>(
      config.maxExplanationCacheSize,
      (key) => {
        this.metrics.explanationEvictions++;
        logger.debug('Evicted file explanation from LRU cache', { key });
      }
    );

    this.canonicalCache = new LruCache<string, ArchitectureOverview>(
      config.maxOverviewCacheSize,
      (key) => {
        this.metrics.overviewEvictions++;
        logger.debug('Evicted canonical overview from LRU cache', { key });
      }
    );

    this.dependencyGraphCache = new LruCache<string, DependencyGraphData>(
      config.maxDependencyGraphCacheSize,
      (key) => {
        this.metrics.graphEvictions++;
        logger.debug('Evicted dependency graph from LRU cache', { key });
      }
    );

    // Register session cleanup listener to invalidate session-scoped cached data
    sessionService.onSessionDeleted((sessionId) => {
      this.invalidateSession(sessionId);
    });

    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory(): void {
    try {
      const cacheDir = path.join(config.sessionsDir, 'cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
    } catch (err) {
      logger.warn('Could not create analysis cache directory', { err });
    }
  }

  /**
   * Computes a pure content-based SHA-256 hash across all files in the repository.
   * Normalizes path separators prior to sorting to guarantee determinism across platforms.
   * Incorporates the full SHA-256 digest of each file's entire content.
   */
  public computeContentHash(files: Map<string, string>): string {
    const hash = crypto.createHash('sha256');
    const normalizedPaths = Array.from(files.keys())
      .map((p) => p.replace(/\\/g, '/'))
      .sort();

    const seen = new Set<string>();
    for (const normPath of normalizedPaths) {
      if (seen.has(normPath)) continue;
      seen.add(normPath);

      hash.update(normPath);
      hash.update('\0');
      const content = files.get(normPath) ?? files.get(normPath.replace(/\//g, '\\')) ?? '';
      const fileDigest = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
      hash.update(fileDigest);
      hash.update('\0');
    }
    return hash.digest('hex');
  }

  /**
   * Compute a deterministic SHA-256 fingerprint representing repository content,
   * archive-level manifest digest, and analysis engine version.
   * Separates origin metadata from content identity.
   * Incorporates rawManifestHash (across ALL files before sampling) to ensure any change
   * outside the analyzed subset invalidates the fingerprint.
   */
  public computeFingerprint(
    session: SessionData,
    options?: { engineVersion?: string }
  ): string {
    const hash = crypto.createHash('sha256');
    const engineVer = options?.engineVersion || ANALYSIS_ENGINE_VERSION;
    hash.update(`engine:${engineVer}\n`);

    // Incorporate raw manifest digest across ALL accepted files before sampling (Priority 1)
    const manifestHash = session.rawManifestHash || this.computeContentHash(session.files);
    hash.update(`manifest:${manifestHash}\n`);

    // Incorporate active session files content hash (Priority 3)
    const contentHash = session.contentHash || this.computeContentHash(session.files);
    hash.update(`content:${contentHash}\n`);

    return hash.digest('hex');
  }

  private getCacheFilePath(fingerprint: string): string {
    const safeId = fingerprint.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(config.sessionsDir, 'cache', `canonical-${safeId}.json`);
  }

  private readFromDiskCache(fingerprint: string): ArchitectureOverview | null {
    try {
      const filePath = this.getCacheFilePath(fingerprint);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw) as ArchitectureOverview;
        if (
          parsed.analysisMode === 'deterministic' ||
          (Array.isArray(parsed.unknowns) &&
            parsed.unknowns.some((u) => typeof u === 'string' && u.includes('AI enrichment unavailable')))
        ) {
          logger.warn('Purging degraded deterministic entry from disk cache', { fingerprint });
          try {
            fs.unlinkSync(filePath);
          } catch {
            // Non-fatal cleanup
          }
          return null;
        }
        parsed.analysisMode = 'cached';
        return parsed;
      }
    } catch (err) {
      logger.warn('Failed to read from disk cache', { fingerprint, err });
    }
    return null;
  }

  private writeToDiskCache(fingerprint: string, overview: ArchitectureOverview): void {
    if (overview.analysisMode !== 'ai-enriched' && overview.analysisMode !== 'cached') {
      return;
    }
    try {
      const cacheDir = path.join(config.sessionsDir, 'cache');
      const safeId = fingerprint.replace(/[^a-zA-Z0-9_-]/g, '');
      const targetPath = path.join(cacheDir, `canonical-${safeId}.json`);
      const tmpPath = path.join(
        cacheDir,
        `.canonical-${safeId}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`
      );

      fs.writeFileSync(tmpPath, JSON.stringify(overview, null, 2), 'utf8');
      fs.renameSync(tmpPath, targetPath);

      // Enforce disk cache TTL and storage budget
      this.cleanExpiredDiskCache();
    } catch (err) {
      logger.warn('Failed to write to disk cache', { fingerprint, err });
    }
  }

  public cleanExpiredDiskCache(): { deletedExpired: number; deletedEvicted: number } {
    let deletedExpired = 0;
    let deletedEvicted = 0;
    try {
      const cacheDir = path.join(config.sessionsDir, 'cache');
      if (!fs.existsSync(cacheDir)) {
        return { deletedExpired: 0, deletedEvicted: 0 };
      }

      const entries = fs.readdirSync(cacheDir, { withFileTypes: true });
      const now = Date.now();
      const ttlMs = config.canonicalDiskCacheTTL * 1000;
      const validFiles: Array<{ name: string; fullPath: string; size: number; mtimeMs: number }> = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(cacheDir, entry.name);

        // Clean up orphaned temporary files older than 1 hour
        if (entry.name.startsWith('.')) {
          try {
            const stat = fs.statSync(fullPath);
            if (now - stat.mtimeMs > 3600 * 1000) {
              fs.unlinkSync(fullPath);
            }
          } catch {}
          continue;
        }

        if (!entry.name.startsWith('canonical-') || !entry.name.endsWith('.json')) {
          continue;
        }

        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > ttlMs) {
            fs.unlinkSync(fullPath);
            deletedExpired++;
          } else {
            validFiles.push({
              name: entry.name,
              fullPath,
              size: stat.size,
              mtimeMs: stat.mtimeMs,
            });
          }
        } catch {}
      }

      // Check storage byte budget
      let totalBytes = validFiles.reduce((acc, f) => acc + f.size, 0);
      const maxBytes = config.maxCanonicalDiskCacheBytes;

      if (totalBytes > maxBytes) {
        // Sort oldest first for LRU disk eviction
        validFiles.sort((a, b) => a.mtimeMs - b.mtimeMs);
        const targetBudget = Math.floor(maxBytes * 0.8);

        for (const file of validFiles) {
          if (totalBytes <= targetBudget) break;
          try {
            fs.unlinkSync(file.fullPath);
            totalBytes -= file.size;
            deletedEvicted++;
          } catch {}
        }
      }
    } catch (err) {
      logger.warn('Error during disk cache cleanup', { err });
    }

    return { deletedExpired, deletedEvicted };
  }

  /**
   * Generate or retrieve the canonical architecture analysis for a session.
   * Guaranteed to be consistent, non-empty, and evidence-grounded.
   * Utilizes in-flight request coalescing to prevent duplicate Groq calls.
   */
  async generateOverview(
    sessionId: string,
    options?: { forceRefresh?: boolean; [key: string]: any }
  ): Promise<ArchitectureOverview | null> {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    const fingerprint = this.computeFingerprint(session);
    const engineVersion = ANALYSIS_ENGINE_VERSION;
    const optionsKey = options && Object.keys(options).length > 0 ? `:${JSON.stringify(options)}` : '';
    const inFlightKey = `${fingerprint}${optionsKey}`;

    if (!options?.forceRefresh) {
      // 1. Session memory cache check — validated against exact fingerprint and engine version
      const sessionCached = session.cachedOverview as ArchitectureOverview | undefined;
      const sessionFp = session.cachedOverviewFingerprint;
      const sessionVer = session.cachedOverviewEngineVersion;

      if (
        sessionCached &&
        sessionFp === fingerprint &&
        sessionVer === engineVersion &&
        sessionCached.analysisMode !== 'deterministic'
      ) {
        this.metrics.overviewHits++;
        return {
          ...this.cloneOverview(sessionCached),
          analysisMode: 'cached',
        };
      } else if (sessionCached && (sessionFp !== fingerprint || sessionVer !== engineVersion)) {
        // Purge stale session cache entry
        delete session.cachedOverview;
        delete session.cachedOverviewFingerprint;
        delete session.cachedOverviewEngineVersion;
      }

      // 2. Repository content fingerprint check (memory)
      if (this.canonicalCache.has(fingerprint)) {
        const cached = this.canonicalCache.get(fingerprint)!;
        if (cached.analysisMode !== 'deterministic') {
          session.cachedOverview = cached;
          session.cachedOverviewFingerprint = fingerprint;
          session.cachedOverviewEngineVersion = engineVersion;
          this.metrics.overviewHits++;
          logger.info('Returning canonical analysis from in-memory cache', { sessionId, fingerprint });
          return {
            ...this.cloneOverview(cached),
            analysisMode: 'cached',
          };
        }
        this.canonicalCache.delete(fingerprint);
      }

      // 3. Disk cache check
      const diskCached = this.readFromDiskCache(fingerprint);
      if (diskCached) {
        this.canonicalCache.set(fingerprint, diskCached);
        session.cachedOverview = diskCached;
        session.cachedOverviewFingerprint = fingerprint;
        session.cachedOverviewEngineVersion = engineVersion;
        this.metrics.overviewHits++;
        logger.info('Returning canonical analysis from disk cache', { sessionId, fingerprint });
        return this.cloneOverview(diskCached);
      }
    }

    // 4. In-flight coalescing check
    if (this.inFlightOverviews.has(inFlightKey)) {
      this.metrics.inFlightOverviewReused++;
      this.metrics.aiCallsAvoided++;
      logger.info('Reusing in-flight overview promise for concurrent request', {
        sessionId,
        fingerprint,
        inFlightKey,
      });
      const inFlightPromise = this.inFlightOverviews.get(inFlightKey)!;
      const result = await inFlightPromise;
      if (result) {
        if (result.analysisMode === 'ai-enriched') {
          session.cachedOverview = result;
          session.cachedOverviewFingerprint = fingerprint;
          session.cachedOverviewEngineVersion = ANALYSIS_ENGINE_VERSION;
        }
        return this.cloneOverview(result);
      }
      return null;
    }

    this.metrics.overviewMisses++;

    // 5. Create in-flight promise and register it
    const overviewPromise = (async () => {
      try {
        return await this.executeOverviewGeneration(session, fingerprint);
      } finally {
        this.inFlightOverviews.delete(inFlightKey);
      }
    })();

    this.inFlightOverviews.set(inFlightKey, overviewPromise);

    const result = await overviewPromise;
    if (result) {
      if (result.analysisMode === 'ai-enriched') {
        (session as any).cachedOverview = result;
      }
      return this.cloneOverview(result);
    }
    return null;
  }

  private async executeOverviewGeneration(
    session: SessionData,
    fingerprint: string
  ): Promise<ArchitectureOverview> {
    // Build rich deterministic canonical foundation
    const deterministic = this.generateDeterministicCanonical(session, fingerprint);

    // Controlled AI Enrichment (prompt-capped to avoid Groq 8000 TPM limit)
    let finalOverview = deterministic;
    try {
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
        'You are a senior software architect. Return strict JSON only matching the schema.',
        { temperature: 0.1, maxTokens: 3000, responseFormat: { type: 'json_object' } }
      );

      const aiParsed = this.parseOverview(rawResponse, deterministic);
      finalOverview = this.mergeAiWithDeterministic(aiParsed, deterministic);
      finalOverview.analysisMode = 'ai-enriched';
      finalOverview.contentHash = fingerprint;

      logger.info('Canonical architecture overview enriched with AI', {
        sessionId: session.sessionId,
        fingerprint,
        responseLength: rawResponse.length,
        evidenceCount: finalOverview.evidence.length,
        riskCount: finalOverview.risks.length,
        confidence: finalOverview.confidence,
      });
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('AI overview enrichment failed, preserving deterministic canonical analysis', {
        sessionId: session.sessionId,
        fingerprint,
        error: errMsg,
      });

      finalOverview.analysisMode = 'deterministic';
      finalOverview.unknowns = [
        `AI enrichment unavailable (${errMsg.substring(0, 120)}); verified deterministic AST analysis applied.`,
      ];
    }

    // Store ONLY verified AI-enriched overviews in memory and persistent disk cache
    if (finalOverview.analysisMode === 'ai-enriched') {
      this.canonicalCache.set(fingerprint, finalOverview);
      this.writeToDiskCache(fingerprint, finalOverview);
      session.cachedOverview = finalOverview;
      session.cachedOverviewFingerprint = fingerprint;
      session.cachedOverviewEngineVersion = ANALYSIS_ENGINE_VERSION;
    }

    return finalOverview;
  }

  /**
   * Deterministic Canonical Extraction:
   * Extracts modules, entry points, layers, execution flow, data flow, and static risks
   * directly from file tree, imports, and code contents.
   */
  public generateDeterministicCanonical(
    session: SessionData,
    fingerprint: string
  ): ArchitectureOverview {
    const files = session.files;
    const metadata = session.metadata;

    const detectedEntryPoints = this.inferEntryPoints(files);
    const detection = frameworkDetectionService.detect(files, metadata);
    const techStack = detection.techStack.length > 0 ? detection.techStack : this.inferTechStack(files, metadata);
    const framework = detection.primaryFramework;
    const pattern = this.detectArchitecturalPattern(files, framework);

    // 1. Compute real dependency graph (JS/TS + Python AST) and extract source signals
    const graph = this.computeDependencyGraph(session);
    const signals = architectureIntelligenceService.extractRepoSignals(files);

    // 1b. Compute accurate language-aware code metrics, cyclomatic complexity & test intelligence
    const codeMetrics = codeMetricsService.computeRepositoryMetrics(files, metadata);

    // 2. Extract Key Modules backed by resolved graph edges & symbols
    const keyModules = architectureIntelligenceService.extractKeyModules(
      files,
      graph,
      detectedEntryPoints,
      signals
    );

    // 3. Extract Dynamic Repository-Specific Architecture Layers
    const architectureLayers = architectureIntelligenceService.extractDynamicArchitectureLayers(
      keyModules,
      graph,
      detectedEntryPoints
    );

    // 4. Extract Dynamic Entry-to-Target Execution Flow
    const executionFlow = architectureIntelligenceService.extractDynamicExecutionFlow(
      detectedEntryPoints,
      graph,
      keyModules,
      detection,
      signals
    );

    // 5. Extract Repository-Specific Data Flow & State Lifecycle
    const { narrative: dataFlow, stages: dataFlowStages } =
      architectureIntelligenceService.extractDynamicDataFlow(
        files,
        graph,
        detection,
        detectedEntryPoints,
        signals
      );

    // 6. Detect Evidence-Based Risks (CONFIRMED / INFERRED / HEURISTIC) & Limitations
    const { risks, limitations: analysisLimitations } =
      architectureIntelligenceService.detectEvidenceBasedRisks(files, graph, detection);

    // 7. Extract Grounded Source Evidence
    const evidence: EvidenceItem[] = [];
    if (detectedEntryPoints.length > 0) {
      evidence.push({
        filePath: detectedEntryPoints[0],
        finding: `Entry module identified at ${detectedEntryPoints[0]}${detectedEntryPoints.length > 1 ? ` (+${detectedEntryPoints.length - 1} more)` : ''}.`,
        relevance: 'Verified entry / public interface location in repository tree.',
      });
    }
    for (const mod of keyModules.slice(0, 5)) {
      evidence.push({
        filePath: mod.path,
        finding: mod.evidence || `Module '${mod.name}' verified in ${mod.path}.`,
        relevance: mod.responsibility,
      });
    }
    for (const r of risks.slice(0, 3)) {
      if (r.filePath && files.has(r.filePath)) {
        evidence.push({
          filePath: r.filePath,
          finding: `[${r.classification || 'INFERRED'}] ${r.title}`,
          relevance: r.evidence || r.detail,
        });
      }
    }

    // 8. Calculate Deterministic Scorecard
    const scorecard = this.calculateDeterministicScorecard(files, risks, keyModules);

    // 9. Repository-Specific Executive Summary & Deep Dive
    const moduleNamesPreview = keyModules.slice(0, 3).map((m) => m.name).join(', ') || 'primary modules';
    const layerNamesPreview = architectureLayers.map((l) => l.name).join(', ') || 'flat structure';
    const confirmedRisksCount = risks.filter((r) => r.classification === 'CONFIRMED').length;

    const summary = `${metadata.name} is a ${detection.projectType} (${metadata.totalFiles} files, primary ecosystem: ${detection.primaryEcosystem}). Analysis mapped ${keyModules.length} core modules (${moduleNamesPreview}) and ${graph.summary.totalEdges} resolved internal dependency edges across ${architectureLayers.length} architectural layers${detectedEntryPoints.length > 0 ? ` anchored at ${detectedEntryPoints[0]}` : ''}.`;

    const executiveBullets = [
      `Classification: ${detection.projectType} (${detection.primaryEcosystem} ecosystem, pattern: ${pattern}).`,
      `Dependencies: ${graph.summary.totalNodes} source nodes and ${graph.summary.totalEdges} resolved internal import edges.`,
      `Key Modules: ${keyModules.slice(0, 4).map((m) => `${m.name} (${m.path})`).join(', ') || 'Single-module layout'}.`,
      `Technology Foundation: ${techStack.slice(0, 6).join(', ') || 'Standard runtime'}.`,
    ];

    const deepDive: DeepDiveExplanation = {
      architectureNarrative: `${metadata.name} organizes ${keyModules.length} core modules into ${layerNamesPreview} (${graph.summary.totalEdges} resolved internal edges).`,
      runtimeFlow: executionFlow.map((s) => `Stage ${s.step} [${s.statusLabel}] ${s.title}: ${s.description}`).join(' '),
      dataLifecycle: dataFlowStages.map((s) => `${s.stage} [${s.classification}]: ${s.description}`).join(' '),
      qualitySignals: `Detected ${risks.length} risk item(s) (${confirmedRisksCount} confirmed) across ${metadata.totalFiles} inspected files.`,
      scalabilityAndOps:
        graph.circularDependencies && graph.circularDependencies.length > 0
          ? `Resolved dependency graph surfaced ${graph.circularDependencies.length} circular module dependency cycle(s) that may affect initialization order and modularity.`
          : `No circular internal module dependencies detected among ${graph.summary.totalNodes} indexed nodes.`,
      recommendations:
        risks.slice(0, 3).map((r) => r.mitigation).join(' ') ||
        'Keep module boundaries decoupled and maintain automated test coverage for core entry paths.',
    };

    return {
      summary,
      executiveBullets,
      pattern,
      techStack,
      projectType: detection.projectType,
      framework,
      primaryEcosystem: detection.primaryEcosystem,
      detectedTechnologies: detection.technologies,
      keyModules,
      dataFlow,
      dataFlowStages,
      deepDive,
      scorecard,
      detectedEntryPoints,
      integrationPoints: detectedEntryPoints.slice(0, 5),
      risks,
      evidence,
      confidence: graph.summary.totalEdges > 0 || keyModules.length >= 2 ? 82 : 68,
      unknowns: [],
      analysisLimitations,
      analysisMode: 'deterministic',
      contentHash: fingerprint,
      executionFlow,
      architectureLayers,
      codeMetrics,
    };
  }

  private detectArchitecturalPattern(files: Map<string, string>, framework?: string): string {
    const paths = Array.from(files.keys()).map((p) => p.toLowerCase());

    if (framework === 'Express.js' || paths.some((p) => p.includes('middleware') || p.includes('router'))) {
      return 'Middleware Pipeline with Router (Chain of Responsibility)';
    }
    if (paths.some((p) => p.includes('controller') && (p.includes('model') || p.includes('view')))) {
      return 'Model-View-Controller (MVC)';
    }
    if (paths.some((p) => p.includes('routes') || p.includes('api'))) {
      return 'Layered REST API';
    }
    if (paths.some((p) => p.includes('components') && p.includes('hooks'))) {
      return 'Component-Driven Architecture';
    }
    return 'Modular Layered Architecture';
  }

  private extractDeterministicRisks(
    files: Map<string, string>,
    modules: KeyModule[]
  ): AnalysisRisk[] {
    const risks: AnalysisRisk[] = [];

    for (const [filePath, content] of files.entries()) {
      const lines = content.split('\n');
      const lineCount = lines.length;

      // 1. Large monolithic files
      if (lineCount > 400 && !filePath.includes('test') && !filePath.includes('min.')) {
        risks.push({
          title: `Monolithic File Complexity in ${path.basename(filePath)}`,
          severity: lineCount > 700 ? 'high' : 'medium',
          category: 'Complexity',
          detail: `File exceeds standard size guidelines with ${lineCount} lines of code, increasing cognitive load and maintenance burden.`,
          mitigation: `Refactor ${filePath} into specialized helper modules and domain services.`,
          percentage: lineCount > 700 ? 80 : 55,
          filePath,
          evidence: `Verified in ${filePath}: ${lineCount} LOC with multi-responsibility execution.`,
          status: 'CONFIRMED AST',
          confidence: 90,
          whyItMatters: 'Large monolithic source files are more prone to regression bugs during concurrent edits.',
        });
      }

      // 2. Dynamic code execution / eval
      if (/\beval\(|\bnew Function\(|child_process\.exec\(/i.test(content)) {
        risks.push({
          title: `Dynamic Code Execution in ${path.basename(filePath)}`,
          severity: 'high',
          category: 'Security',
          detail: `Detected dynamic evaluation or process execution invocation, which poses code injection hazards if input is unvalidated.`,
          mitigation: 'Replace dynamic evaluation with static mappings or parameterized function dispatchers.',
          percentage: 85,
          filePath,
          evidence: `Verified dynamic execution keyword in ${filePath}.`,
          status: 'CONFIRMED AST',
          confidence: 92,
          whyItMatters: 'Arbitrary code execution vulnerabilities allow malicious inputs to compromise the host process.',
        });
      }

      // 3. High import fan-out (coupling)
      const importCount = (content.match(/require\(|import\s+/g) || []).length;
      if (importCount > 15 && !filePath.includes('test')) {
        risks.push({
          title: `High Dependency Coupling in ${path.basename(filePath)}`,
          severity: 'medium',
          category: 'Maintainability',
          detail: `Module imports ${importCount} dependencies, indicating tight coupling across disparate subsystems.`,
          mitigation: 'Introduce facade interfaces or dependency injection to decouple subsystems.',
          percentage: 60,
          filePath,
          evidence: `Counted ${importCount} external and internal imports in ${filePath}.`,
          status: 'CONFIRMED AST',
          confidence: 88,
          whyItMatters: 'High coupling makes isolated unit testing difficult and causes cascading build failures.',
        });
      }
    }

    // Fallback: If no high/medium risks found, provide architectural observation
    if (risks.length === 0) {
      risks.push({
        title: 'Minimal Test and Specification Boundary Verification',
        severity: 'low',
        category: 'Maintainability',
        detail: 'Analyzed repository exhibits low surface risk. Continued maintenance should focus on regression test coverage.',
        mitigation: 'Ensure critical module interfaces have automated integration test suites.',
        percentage: 25,
        filePath: modules[0]?.path || 'root',
        evidence: 'Scanned repository scope showed zero critical code injection or monolithic anti-patterns.',
        status: 'CONFIRMED AST',
        confidence: 85,
        whyItMatters: 'Consistent test coverage prevents regressions as codebase scale expands.',
      });
    }

    return risks.slice(0, 6);
  }

  private calculateDeterministicScorecard(
    files: Map<string, string>,
    risks: AnalysisRisk[],
    modules: KeyModule[]
  ): AnalysisScorecard {
    const totalFiles = files.size;
    const hasReadme = Array.from(files.keys()).some((k) => /readme/i.test(k));
    const hasTests = Array.from(files.keys()).some((k) => /test|spec/i.test(k));
    // Exclude bundled third-party code findings from first-party repository risk scoring
    const firstPartyRisks = risks.filter((r) => r.provenance !== 'bundled-third-party');
    const highRisks = firstPartyRisks.filter((r) => r.severity === 'high').length;
    const medRisks = firstPartyRisks.filter((r) => r.severity === 'medium').length;

    const architecture = Math.min(95, Math.max(50, 75 + (modules.length >= 5 ? 10 : 0) - highRisks * 5));
    const maintainability = Math.min(95, Math.max(45, 80 - highRisks * 8 - medRisks * 4 + (hasReadme ? 5 : 0)));
    const complexity = Math.min(95, Math.max(40, 70 - (totalFiles > 100 ? 10 : 0) - medRisks * 3));
    const reliability = Math.min(95, Math.max(50, 72 + (hasTests ? 12 : -8) - highRisks * 6));
    const security = Math.min(95, Math.max(50, 85 - highRisks * 12 - medRisks * 4));

    return {
      architecture,
      maintainability,
      complexity,
      reliability,
      security,
    };
  }

  private mergeAiWithDeterministic(
    ai: ArchitectureOverview,
    deterministic: ArchitectureOverview
  ): ArchitectureOverview {
    // Merge summary: keep AI summary if valid
    const summary = (ai.summary && !ai.summary.includes('could not be parsed'))
      ? ai.summary
      : deterministic.summary;

    const pattern = (ai.pattern && ai.pattern !== 'Unknown')
      ? ai.pattern
      : deterministic.pattern;

    // Merge key modules: combine AI modules with deterministic modules, ensuring no duplicates
    const moduleMap = new Map<string, KeyModule>();
    for (const mod of deterministic.keyModules) {
      moduleMap.set(mod.path.toLowerCase(), mod);
    }
    for (const mod of ai.keyModules || []) {
      if (mod && mod.path && mod.name) {
        moduleMap.set(mod.path.toLowerCase(), {
          ...mod,
          dependencies: moduleMap.get(mod.path.toLowerCase())?.dependencies || mod.dependencies || [],
        });
      }
    }
    const keyModules = Array.from(moduleMap.values()).slice(0, 10);

    // Merge risks: Combine deterministic evidence-backed findings with clearly labeled AI inferences
    const riskTitles = new Set<string>();
    const mergedRisks: AnalysisRisk[] = [];
    for (const r of deterministic.risks) {
      riskTitles.add(r.title.toLowerCase());
      mergedRisks.push(r);
    }
    const knownPaths = new Set([
      ...deterministic.keyModules.map((m) => m.path),
      ...deterministic.evidence.map((e) => e.filePath),
      ...(deterministic.detectedEntryPoints || []),
      ...(ai.keyModules || []).map((m) => m.path),
    ]);
    for (const r of ai.risks || []) {
      if (r && r.title && !riskTitles.has(r.title.toLowerCase())) {
        riskTitles.add(r.title.toLowerCase());
        const verifiedPath = r.filePath && knownPaths.has(r.filePath) ? r.filePath : undefined;
        const sourceRefs = Array.isArray(r.sourceReferences) && r.sourceReferences.length > 0
          ? r.sourceReferences
          : (verifiedPath ? [{ filePath: verifiedPath, label: 'AI referenced file' }] : []);
        const hasSourceRefs = sourceRefs.length > 0;
        // Cap unanchored AI observations at medium
        const rawSeverity = String(r.severity || 'medium').toLowerCase();
        const severity = (!verifiedPath && !hasSourceRefs && rawSeverity === 'high') ? 'medium' : (rawSeverity === 'low' || rawSeverity === 'medium' || rawSeverity === 'high' ? rawSeverity : 'medium');
        mergedRisks.push({
          ...r,
          severity,
          ...(verifiedPath ? { filePath: verifiedPath } : { filePath: undefined }),
          sourceReferences: sourceRefs,
          status: 'INFERRED',
          classification: 'INFERRED',
          detectionMethod: 'ai-architecture-review',
          confidence: verifiedPath ? 72 : 58,
          provenance: 'first-party',
        });
      }
    }

    const dataFlow = (ai.dataFlow && !ai.dataFlow.includes('Insufficient data'))
      ? ai.dataFlow
      : deterministic.dataFlow;

    const deepDive = {
      architectureNarrative: (ai.deepDive?.architectureNarrative && !ai.deepDive.architectureNarrative.includes('Not available'))
        ? ai.deepDive.architectureNarrative
        : deterministic.deepDive.architectureNarrative,
      runtimeFlow: (ai.deepDive?.runtimeFlow && !ai.deepDive.runtimeFlow.includes('Not available'))
        ? ai.deepDive.runtimeFlow
        : deterministic.deepDive.runtimeFlow,
      dataLifecycle: (ai.deepDive?.dataLifecycle && !ai.deepDive.dataLifecycle.includes('Not available'))
        ? ai.deepDive.dataLifecycle
        : deterministic.deepDive.dataLifecycle,
      qualitySignals: (ai.deepDive?.qualitySignals && !ai.deepDive.qualitySignals.includes('Not available'))
        ? ai.deepDive.qualitySignals
        : deterministic.deepDive.qualitySignals,
      scalabilityAndOps: (ai.deepDive?.scalabilityAndOps && !ai.deepDive.scalabilityAndOps.includes('Not available'))
        ? ai.deepDive.scalabilityAndOps
        : deterministic.deepDive.scalabilityAndOps,
      recommendations: (ai.deepDive?.recommendations && !ai.deepDive.recommendations.includes('Not available'))
        ? ai.deepDive.recommendations
        : deterministic.deepDive.recommendations,
    };

    return {
      ...deterministic,
      summary,
      pattern,
      keyModules,
      dataFlow,
      deepDive,
      risks: mergedRisks.slice(0, 8),
      confidence: Math.max(deterministic.confidence, ai.confidence || 85),
      executiveBullets: (ai.executiveBullets && ai.executiveBullets.length > 0)
        ? ai.executiveBullets
        : deterministic.executiveBullets,
    };
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

    const contentHash = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');
    const normPath = actualPath.replace(/\\/g, '/');
    const repoContext = session.sourceUrl || session.metadata?.name || 'unnamed';
    const cacheKey = `${ANALYSIS_ENGINE_VERSION}:${repoContext}:${normPath}:${contentHash}`;

    // 1. Check LRU cache (never serve stale deterministic fallbacks from cache)
    const cached = this.explanationCache.get(cacheKey);
    if (cached && cached.analysisMode !== 'deterministic') {
      this.metrics.explanationHits++;
      this.metrics.aiCallsAvoided++;
      logger.info('Returning file explanation from cache', {
        sessionId,
        filePath: actualPath,
        contentHash: contentHash.substring(0, 8),
      });
      return {
        ...this.cloneFileExplanation(cached),
        analysisMode: 'cached',
      };
    }

    this.metrics.explanationMisses++;

    const language = detectLanguage(actualPath);
    const deterministic = this.extractDeterministicFileInfo(actualPath, fileContent, language);
    deterministic.analysisMode = 'deterministic';

    try {
      const truncated =
        fileContent.length > 5000
          ? `${fileContent.substring(0, 5000)}\n// ... [remaining content truncated for analysis]`
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
        {
          temperature: 0.1,
          maxTokens: 3200,
          responseFormat: { type: 'json_object' },
          reasoningEffort: 'low',
        }
      );

      const parsed = this.parseFileExplanation(rawResponse, actualPath, deterministic);
      logger.info('File explanation generated', {
        sessionId,
        filePath: actualPath,
        functionsCount: parsed.keyFunctions.length,
        complexity: parsed.complexity,
        analysisMode: parsed.analysisMode,
      });

      // Cache ONLY verified AI-enriched explanations
      if (parsed.analysisMode === 'ai-enriched') {
        this.explanationCache.set(cacheKey, parsed);
      }
      return this.cloneFileExplanation(parsed);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('AI file explanation generation failed, returning deterministic fallback (uncached)', {
        sessionId,
        filePath: actualPath,
        error: errMsg,
      });
      // Do NOT cache failed/unparseable AI requests
      return {
        ...this.cloneFileExplanation(deterministic),
        analysisMode: 'deterministic',
        fallbackReason: errMsg.substring(0, 140),
      };
    }
  }

  private renderTree(nodes: FileNode[], level = 0): string {
    const lines: string[] = [];
    const maxLines = 800;

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
      .slice(0, 8)
      .map(([lang, count]) => `${lang}: ${count}`)
      .join(', ');

    const topFileTypes = Object.entries(metadata.fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ext, count]) => `${ext}: ${count}`)
      .join(', ');

    return [
      `Repository: ${metadata.name}`,
      `Total files: ${metadata.totalFiles}`,
      `Top languages: ${topLanguages}`,
      `Top file types: ${topFileTypes}`,
    ].join('\n');
  }

  private pickRepresentativeFiles(files: Map<string, string>): Record<string, string> {
    const entries = Array.from(files.entries());
    const priorityPatterns = [
      /readme/i,
      /package\.json$/,
      /requirements\.txt$/,
      /pyproject\.toml$/,
      /src\/app\./,
      /src\/main\./,
      /server\./,
      /index\.(ts|tsx|js|jsx|py)$/,
      /router/i,
      /controller/i,
    ];

    const scored = entries.map(([filePath, content]) => {
      let score = 0;
      const lower = filePath.toLowerCase();
      priorityPatterns.forEach((p, idx) => {
        if (p.test(lower)) score += (priorityPatterns.length - idx) * 2;
      });
      return { filePath, content, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Keep token count compact (max 6 files, 600 chars each = ~1,200 tokens safe for Groq TPM)
    const selected: Record<string, string> = {};
    for (const item of scored.slice(0, 6)) {
      selected[item.filePath] = item.content.substring(0, 600);
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

  private parseOverview(raw: string, fallback: ArchitectureOverview): ArchitectureOverview {
    const json = this.extractJson(raw);
    const parsed = JSON.parse(json) as Partial<ArchitectureOverview> & {
      keyModules?: Partial<KeyModule>[];
      risks?: Partial<AnalysisRisk>[];
    };

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('AI overview response JSON is not an object');
    }

    const hasCoreFields =
      (typeof parsed.summary === 'string' && parsed.summary.trim().length > 0) ||
      (typeof parsed.pattern === 'string' && parsed.pattern.trim().length > 0) ||
      (Array.isArray(parsed.keyModules) && parsed.keyModules.length > 0);
    if (!hasCoreFields) {
      throw new Error('AI overview response JSON missing required architectural fields');
    }

    const keyModules = (parsed.keyModules || [])
      .filter((m) => m && (m.name || m.path || m.responsibility))
      .map((m) => ({
        name: (m.name || 'Module').trim(),
        path: (m.path || 'unknown').trim(),
        responsibility: (m.responsibility || 'Responsibility not specified').trim(),
        dependencies: Array.isArray(m.dependencies) ? m.dependencies.map(String) : [],
      }));

    const risks = (parsed.risks || [])
      .filter((r) => r && (r.title || r.detail))
      .map((r) => {
        const severity = String(r.severity || 'medium').toLowerCase();
        const filePath = typeof r.filePath === 'string' && r.filePath.trim().length > 0 ? r.filePath.trim() : undefined;
        const sourceReferences = Array.isArray(r.sourceReferences) && r.sourceReferences.length > 0
          ? r.sourceReferences
          : (filePath ? [{ filePath, label: 'AI referenced file' }] : []);
        const hasSourceRefs = sourceReferences.length > 0;
        const mappedSeverity = severity === 'high' || severity === 'medium' || severity === 'low'
          ? (severity === 'high' && !hasSourceRefs ? 'medium' : severity)
          : 'medium';
        return {
          title: (r.title || 'Risk').trim(),
          severity: mappedSeverity,
          detail: (r.detail || 'No details provided').trim(),
          mitigation: (r.mitigation || 'No mitigation provided').trim(),
          percentage: typeof r.percentage === 'number' ? r.percentage : 50,
          category: r.category || 'Maintainability',
          status: 'INFERRED',
          classification: 'INFERRED',
          detectionMethod: 'ai-architecture-review',
          confidence: filePath ? 70 : 60,
          provenance: 'first-party',
          filePath,
          sourceReferences,
        } as AnalysisRisk;
      });

    const mergedTechStack = (() => {
      const base = Array.isArray(fallback.techStack) ? fallback.techStack : [];
      if (!Array.isArray(parsed.techStack) || parsed.techStack.length === 0) return base;
      const aiItems = parsed.techStack
        .map(String)
        .filter((item) => {
          if (fallback.primaryEcosystem === 'python' && /^node(\.js)?$/i.test(item.trim())) {
            return false;
          }
          return Boolean(item.trim());
        });
      return Array.from(new Set([...base, ...aiItems]));
    })();

    return {
      ...fallback,
      summary: String(parsed.summary || fallback.summary).trim(),
      pattern: String(parsed.pattern || fallback.pattern).trim(),
      techStack: mergedTechStack,
      keyModules: keyModules.length > 0 ? keyModules : fallback.keyModules,
      risks: risks.length > 0 ? risks : fallback.risks,
      dataFlow: String(parsed.dataFlow || fallback.dataFlow).trim(),
      confidence: Number(parsed.confidence) || fallback.confidence,
      executiveBullets: Array.isArray(parsed.executiveBullets) && parsed.executiveBullets.length > 0
        ? parsed.executiveBullets
        : fallback.executiveBullets,
    };
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

    return Array.from(inferred).map((item) => item.trim()).filter(Boolean);
  }

  private inferEntryPoints(files: Map<string, string>): string[] {
    const candidates: string[] = [];
    const patterns = [
      /(^|\/)src\/main\./i,
      /(^|\/)src\/app\./i,
      /(^|\/)main\.(ts|tsx|js|jsx|py|go|rs|java)$/i,
      /(^|\/)index\.(ts|tsx|js|jsx|py|go|rs|java)$/i,
      /(^|\/)server\.(ts|js|py)$/i,
      /(^|\/)app\.(ts|tsx|js|jsx|py)$/i,
      /(^|\/)(cli|wsgi|asgi|manage|__main__)\.(ts|js|py)$/i,
      /(^|\/)cmd\//i,
      /(^|\/)routes?\//i,
    ];

    for (const filePath of files.keys()) {
      if (patterns.some((pattern) => pattern.test(filePath))) {
        candidates.push(filePath);
      }
    }

    return candidates.slice(0, 10);
  }

  private extractDeterministicFileInfo(
    filePath: string,
    content: string,
    language: string
  ): FileExplanation {
    const lines = content.split('\n');
    const totalLines = lines.length;

    const dependencies: string[] = [];
    const jsImportRegex = /(?:import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]+\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    let match: RegExpExecArray | null;
    while ((match = jsImportRegex.exec(content)) !== null) {
      const dep = match[1] || match[2];
      if (dep && !dependencies.includes(dep)) {
        dependencies.push(dep);
      }
    }

    const exportsList: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1] && !exportsList.includes(match[1])) {
        exportsList.push(match[1]);
      }
    }

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

    return {
      filePath,
      purpose: `Provides core logic and services for ${path.basename(filePath)} in the project structure.`,
      keyFunctions,
      dependencies: dependencies.slice(0, 15),
      exports: exportsList.slice(0, 15),
      patterns: [`${language.toUpperCase()} module implementation`],
      complexity,
    };
  }

  private parseFileExplanation(
    raw: string,
    filePath: string,
    fallback: FileExplanation
  ): FileExplanation {
    const json = this.extractJson(raw);
    const parsed = JSON.parse(json) as Partial<FileExplanation>;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('AI file explanation JSON is not an object');
    }

    const purpose = typeof parsed.purpose === 'string' ? parsed.purpose.trim() : '';
    if (!purpose) {
      throw new Error('AI file explanation JSON missing required purpose field');
    }

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

    return {
      filePath,
      purpose,
      keyFunctions,
      dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies.map(String) : fallback.dependencies,
      exports: Array.isArray(parsed.exports) ? parsed.exports.map(String) : fallback.exports,
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns.map(String) : fallback.patterns,
      complexity,
      analysisMode: 'ai-enriched',
    };
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
        { temperature: 0.1, maxTokens: 1600 }
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
        { temperature: 0.1, maxTokens: 1200 }
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

  /**
   * Extract comprehensive, deterministic Dependency Graph representing real file-to-file
   * relationships, import declarations, exports, and architectural classifications.
   * Cached against repository content fingerprint with defensive copying.
   */
  public extractDependencyGraph(sessionId: string): DependencyGraphData | null {
    const session = sessionService.getSession(sessionId);
    if (!session) return null;

    const fingerprint = this.computeFingerprint(session);

    // 1. Check cache
    const cached = this.dependencyGraphCache.get(fingerprint);
    if (cached) {
      this.metrics.graphHits++;
      logger.info('Returning dependency graph from cache', { sessionId, fingerprint });
      return this.cloneDependencyGraph(cached);
    }

    this.metrics.graphMisses++;

    // 2. Compute graph
    const graph = this.computeDependencyGraph(session);
    if (graph) {
      this.dependencyGraphCache.set(fingerprint, graph);
      return this.cloneDependencyGraph(graph);
    }

    return null;
  }

  private computeDependencyGraph(session: SessionData): DependencyGraphData {
    const files = session.files;
    const detectedEntryPoints = this.inferEntryPoints(files);

    // 1. Helper to resolve relative and JS/TS alias imports to a real repository file path
    const resolveImportPath = (currentFilePath: string, importSpecifier: string): string | null => {
      if (!importSpecifier || importSpecifier.startsWith('node:') || (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('@/'))) {
        return null;
      }

      const currentDir = path.dirname(currentFilePath);
      let targetBase = importSpecifier.startsWith('@/')
        ? importSpecifier.replace(/^@\//, 'src/')
        : path.normalize(path.join(currentDir, importSpecifier)).replace(/\\/g, '/');

      if (targetBase.startsWith('./')) targetBase = targetBase.slice(2);

      const candidateExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      for (const ext of candidateExtensions) {
        const testPath = `${targetBase}${ext}`;
        if (files.has(testPath)) {
          return testPath;
        }
      }

      if (importSpecifier.startsWith('@/')) {
        const withoutSrc = importSpecifier.replace(/^@\//, '');
        for (const ext of candidateExtensions) {
          const testPath = `${withoutSrc}${ext}`;
          if (files.has(testPath)) {
            return testPath;
          }
        }
      }

      return null;
    };

    // 2. Classify node type
    const classifyNodeType = (filePath: string, content: string): DependencyNodeType => {
      const lower = filePath.toLowerCase();
      const base = path.basename(filePath).toLowerCase();

      // Primary entry points
      if (
        /^(server|index|app|main|express|wsgi|asgi|manage|__main__)\.(ts|js|py|go)$/.test(base) ||
        lower === 'src/index.ts' ||
        lower === 'src/main.ts' ||
        lower === 'src/server.ts' ||
        lower === 'src/app.tsx' ||
        lower === 'src/app/page.tsx' ||
        lower === 'lib/express.js' ||
        lower === 'index.js'
      ) {
        return 'entry';
      }
      // Routes & API endpoints
      if (lower.includes('routes') || lower.includes('route.') || lower.includes('router') || lower.includes('blueprint') || lower.includes('/api/')) {
        return 'route';
      }
      // Controllers & Handlers
      if (lower.includes('controller') || lower.includes('handler') || lower.includes('request.') || lower.includes('response.')) {
        return 'controller';
      }
      // AI & LLM modules
      if (lower.includes('openai') || lower.includes('gemini') || lower.includes('llm') || lower.includes('ai/') || /prompt/i.test(lower)) {
        return 'ai';
      }
      // Services & Domain Logic
      if (lower.includes('service') || lower.includes('core') || lower.includes('domain') || lower.includes('engine') || lower.includes('application.')) {
        return 'service';
      }
      // Components & Views
      if (lower.includes('component') || lower.includes('ui/') || lower.includes('view.') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
        return 'component';
      }
      // Storage & Models
      if (lower.includes('model') || lower.includes('db') || lower.includes('store') || lower.includes('entity') || lower.includes('repository') || lower.includes('storage') || lower.includes('session')) {
        return 'storage';
      }
      // Configuration & Manifests
      if (
        lower.endsWith('.config.js') ||
        lower.endsWith('.config.ts') ||
        lower.endsWith('.json') ||
        lower.endsWith('.toml') ||
        base === 'setup.cfg' ||
        base.startsWith('requirements') ||
        lower.includes('config') ||
        lower.includes('.env')
      ) {
        return 'config';
      }
      if (detectedEntryPoints.includes(filePath)) {
        return 'entry';
      }
      return 'utility';
    };

    // 3. Extract exports (JS/TS)
    const extractJsExports = (content: string): string[] => {
      const exports: string[] = [];
      const jsExportRegex = /(?:export\s+(?:default\s+)?(?:class|function|const|let|var|type|interface)\s+([A-Za-z0-9_$]+)|module\.exports\s*=\s*([A-Za-z0-9_$]+)|exports\.([A-Za-z0-9_$]+)\s*=)/g;
      let m: RegExpExecArray | null;
      while ((m = jsExportRegex.exec(content)) !== null) {
        const name = m[1] || m[2] || m[3];
        if (name && !exports.includes(name)) exports.push(name);
      }
      return exports.slice(0, 8);
    };

    // 4. Extract imports (JS/TS)
    const extractJsImports = (content: string): string[] => {
      const imports: string[] = [];
      const jsRegex = /(?:import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]+\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
      let m: RegExpExecArray | null;
      while ((m = jsRegex.exec(content)) !== null) {
        const spec = m[1] || m[2];
        if (spec && !imports.includes(spec)) imports.push(spec);
      }
      return imports;
    };

    // 5. Partition active graph nodes and prepare batch Python AST parsing
    const includedEntries: Array<[string, string]> = [];
    const includedNormalizedFiles = new Set<string>();
    const pythonFilesToParse = new Map<string, string>();
    const normalizedToOriginalPath = new Map<string, string>();

    for (const [filePath, content] of files.entries()) {
      const lower = filePath.toLowerCase();
      if (pythonDependencyService.isPythonFile(filePath)) {
        if (pythonDependencyService.isExcludedPythonTestOrBuildFile(filePath)) {
          continue;
        }
        const normPath = pythonDependencyService.normalizePath(filePath);
        includedEntries.push([filePath, content]);
        includedNormalizedFiles.add(normPath);
        normalizedToOriginalPath.set(normPath, filePath);
        pythonFilesToParse.set(normPath, content);
        continue;
      }

      if (
        lower.endsWith('.md') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.svg') ||
        lower.endsWith('.lock') ||
        lower.endsWith('.map') ||
        lower.includes('test') ||
        lower.includes('spec') ||
        lower.includes('dist/') ||
        lower.includes('build/')
      ) {
        continue;
      }
      includedEntries.push([filePath, content]);
      const normPath = pythonDependencyService.normalizePath(filePath);
      includedNormalizedFiles.add(normPath);
      normalizedToOriginalPath.set(normPath, filePath);
    }

    const { parsedFiles: parsedPythonFiles, runtimeStdlib } = pythonDependencyService.parsePythonFiles(pythonFilesToParse);
    const pyIndex = pythonDependencyService.buildRepoIndex(files, includedNormalizedFiles, runtimeStdlib);

    let pythonFilesScanned = 0;
    let importStatementsExtracted = 0;
    let internalDependenciesResolved = 0;
    const allExternalDependencies = new Set<string>();
    const allStdlibImports = new Set<string>();
    const allUnresolvedImports: UnresolvedImportEntry[] = [];
    const allAmbiguousResolutions: AmbiguousResolutionEntry[] = [];

    // 6. Build nodes
    const nodeMap = new Map<string, DependencyGraphNode>();
    for (const [filePath, content] of includedEntries) {
      const lineCount = content.split('\n').length;
      const nodeType = classifyNodeType(filePath, content);
      let rawImports: string[] = [];
      let resolvedImports: string[] = [];
      let exports: string[] = [];
      let externalImports: string[] | undefined;
      let stdlibImports: string[] | undefined;
      let unresolvedNodeImports: string[] | undefined;

      if (pythonDependencyService.isPythonFile(filePath)) {
        pythonFilesScanned++;
        const normPath = pythonDependencyService.normalizePath(filePath);
        const parsedPy = parsedPythonFiles.get(normPath) || pythonDependencyService.parsePythonSourceFallback(content);
        const pyResolved = pythonDependencyService.resolveFileDependencies(normPath, parsedPy, pyIndex);

        importStatementsExtracted += pyResolved.statementsExtracted;
        rawImports = pyResolved.rawImports;
        resolvedImports = pyResolved.resolvedInternal
          .map((normTarget) => normalizedToOriginalPath.get(normTarget) || normTarget)
          .filter((target) => target !== filePath);
        exports = pyResolved.exports;

        internalDependenciesResolved += resolvedImports.length;
        for (const ext of pyResolved.externalImports) allExternalDependencies.add(ext);
        for (const std of pyResolved.stdlibImports) allStdlibImports.add(std);
        for (const unres of pyResolved.unresolvedImports) allUnresolvedImports.push(unres);
        for (const amb of pyResolved.ambiguousResolutions) allAmbiguousResolutions.push(amb);

        if (pyResolved.externalImports.length > 0) externalImports = pyResolved.externalImports;
        if (pyResolved.stdlibImports.length > 0) stdlibImports = pyResolved.stdlibImports;
        if (pyResolved.unresolvedImports.length > 0) {
          unresolvedNodeImports = pyResolved.unresolvedImports.map((u) => u.specifier);
        }
      } else {
        rawImports = extractJsImports(content);
        exports = extractJsExports(content);
        for (const spec of rawImports) {
          const resolved = resolveImportPath(filePath, spec);
          if (resolved && resolved !== filePath && !resolvedImports.includes(resolved)) {
            resolvedImports.push(resolved);
          }
        }
      }

      const baseName = path.basename(filePath);
      const description = `${nodeType.toUpperCase()} module with ${lineCount} LOC and ${resolvedImports.length} internal imports.`;

      const layerMap: Record<DependencyNodeType, string> = {
        entry: 'Entry & Bootstrap',
        route: 'Routing & API',
        controller: 'Controllers & Handlers',
        service: 'Services & Domain Logic',
        component: 'Components & Views',
        storage: 'Storage & Models',
        ai: 'AI & Machine Learning',
        config: 'Configuration',
        utility: 'Utilities & Helpers',
      };

      const nodeObj: DependencyGraphNode = {
        id: filePath,
        label: baseName,
        path: filePath,
        type: nodeType,
        layer: layerMap[nodeType] || 'Utilities & Helpers',
        description,
        imports: rawImports.slice(0, 12),
        resolvedImports,
        importedBy: [],
        exports,
        loc: lineCount,
        status: 'confirmed',
      };
      if (externalImports) nodeObj.externalImports = externalImports;
      if (stdlibImports) nodeObj.stdlibImports = stdlibImports;
      if (unresolvedNodeImports) nodeObj.unresolvedImports = unresolvedNodeImports;

      nodeMap.set(filePath, nodeObj);
    }

    // 7. Connect edges, calculate importedBy, and detect cycles
    const edges: DependencyGraphEdge[] = [];
    const edgeSet = new Set<string>();
    const adjacency = new Map<string, string[]>();

    for (const [sourcePath, node] of nodeMap.entries()) {
      const uniqueTargets: string[] = [];
      for (const targetPath of node.resolvedImports) {
        const targetNode = nodeMap.get(targetPath);
        if (targetNode) {
          if (!targetNode.importedBy.includes(sourcePath)) {
            targetNode.importedBy.push(sourcePath);
          }
          if (!uniqueTargets.includes(targetPath)) {
            uniqueTargets.push(targetPath);
          }
          const edgeId = `e-${sourcePath}->${targetPath}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            edges.push({
              id: edgeId,
              source: sourcePath,
              target: targetPath,
              type: 'import',
              animated: node.type === 'entry',
            });
          }
        }
      }
      adjacency.set(sourcePath, uniqueTargets);
    }

    const circularDependencies = pythonDependencyService.detectCircularDependencies(adjacency);
    const nodes = Array.from(nodeMap.values());
    const entryPoints = nodes.filter((n) => n.type === 'entry').map((n) => n.id);
    const isolatedNodes = nodes.filter((n) => n.resolvedImports.length === 0 && n.importedBy.length === 0).length;
    const density = nodes.length > 1 ? Number((edges.length / (nodes.length * (nodes.length - 1))).toFixed(4)) : 0;

    const graphData: DependencyGraphData = {
      nodes,
      edges,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        entryPoints,
        isolatedNodes,
        density,
      },
    };

    if (circularDependencies.length > 0) {
      graphData.circularDependencies = circularDependencies;
    }

    if (pythonFilesScanned > 0 || pyIndex.manifestsDetected.length > 0) {
      graphData.diagnostics = {
        pythonFilesScanned,
        importStatementsExtracted,
        internalDependenciesResolved,
        externalDependencies: Array.from(allExternalDependencies).sort(),
        stdlibImports: Array.from(allStdlibImports).sort(),
        unresolvedImports: allUnresolvedImports,
        circularDependencies,
        ambiguousResolutions: allAmbiguousResolutions,
        manifestsDetected: pyIndex.manifestsDetected,
      };
    }

    return graphData;
  }

  public invalidateDependencyGraph(fingerprint?: string): void {
    if (fingerprint) {
      this.dependencyGraphCache.delete(fingerprint);
    } else {
      this.dependencyGraphCache.clear();
    }
  }

  /**
   * Explicitly invalidate cached overview and dependency graph for a fingerprint,
   * removing from both memory LRU caches and disk cache.
   */
  public invalidateCache(fingerprint: string): void {
    if (!fingerprint) return;
    this.canonicalCache.delete(fingerprint);
    this.dependencyGraphCache.delete(fingerprint);
    try {
      const diskPath = this.getCacheFilePath(fingerprint);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (err) {
      logger.warn('Failed to delete cache file from disk', { fingerprint, err });
    }
    // Also invalidate session-level cached overviews across all matching active sessions
    sessionService.invalidateSessionOverviews(fingerprint);
    logger.info('Invalidated cache for fingerprint', { fingerprint });
  }

  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.metrics = {
      explanationHits: 0,
      explanationMisses: 0,
      explanationEvictions: 0,
      overviewHits: 0,
      overviewMisses: 0,
      overviewEvictions: 0,
      graphHits: 0,
      graphMisses: 0,
      graphEvictions: 0,
      inFlightOverviewReused: 0,
      aiCallsAvoided: 0,
    };
  }

  public clearCaches(): void {
    this.explanationCache.clear();
    this.canonicalCache.clear();
    this.dependencyGraphCache.clear();
    this.inFlightOverviews.clear();

    // Clean disk cache files to ensure a completely cold cache when requested
    try {
      const cacheDir = path.join(config.sessionsDir, 'cache');
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        for (const file of files) {
          if (file.startsWith('canonical-') && file.endsWith('.json')) {
            try {
              fs.unlinkSync(path.join(cacheDir, file));
            } catch {}
          }
        }
      }
    } catch {}
  }

  /**
   * Invalidate and purge all session-scoped cached entries (e.g. file explanations)
   * when a session is deleted or expires.
   */
  public invalidateSession(sessionId: string): number {
    const prefix = `${sessionId}:`;
    let count = 0;
    for (const key of this.explanationCache.keys()) {
      if (key.startsWith(prefix)) {
        this.explanationCache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      logger.info('Purged session-scoped explanation cache entries', { sessionId, count });
    }
    return count;
  }

  private cloneFileExplanation(explanation: FileExplanation): FileExplanation {
    return {
      ...explanation,
      keyFunctions: explanation.keyFunctions.map((fn) => ({
        ...fn,
        parameters: Array.isArray(fn.parameters) ? [...fn.parameters] : [],
      })),
      dependencies: Array.isArray(explanation.dependencies) ? [...explanation.dependencies] : [],
      exports: Array.isArray(explanation.exports) ? [...explanation.exports] : [],
      patterns: Array.isArray(explanation.patterns) ? [...explanation.patterns] : [],
    };
  }

  private cloneDependencyGraph(data: DependencyGraphData): DependencyGraphData {
    const cloned: DependencyGraphData = {
      nodes: data.nodes.map((node) => ({
        ...node,
        imports: [...node.imports],
        resolvedImports: [...node.resolvedImports],
        importedBy: [...node.importedBy],
        exports: [...node.exports],
        ...(node.externalImports ? { externalImports: [...node.externalImports] } : {}),
        ...(node.stdlibImports ? { stdlibImports: [...node.stdlibImports] } : {}),
        ...(node.unresolvedImports ? { unresolvedImports: [...node.unresolvedImports] } : {}),
      })),
      edges: data.edges.map((edge) => ({ ...edge })),
      summary: {
        ...data.summary,
        entryPoints: [...data.summary.entryPoints],
      },
    };
    if (data.circularDependencies) {
      cloned.circularDependencies = data.circularDependencies.map((cycle) => [...cycle]);
    }
    if (data.diagnostics) {
      cloned.diagnostics = {
        ...data.diagnostics,
        externalDependencies: [...data.diagnostics.externalDependencies],
        stdlibImports: [...data.diagnostics.stdlibImports],
        unresolvedImports: data.diagnostics.unresolvedImports.map((u) => ({ ...u })),
        circularDependencies: data.diagnostics.circularDependencies.map((c) => [...c]),
        ambiguousResolutions: data.diagnostics.ambiguousResolutions.map((a) => ({
          ...a,
          candidates: [...a.candidates],
        })),
        manifestsDetected: [...data.diagnostics.manifestsDetected],
      };
    }
    return cloned;
  }

  private cloneOverview(overview: ArchitectureOverview): ArchitectureOverview {
    return {
      ...overview,
      techStack: Array.isArray(overview.techStack) ? [...overview.techStack] : [],
      detectedEntryPoints: Array.isArray(overview.detectedEntryPoints) ? [...overview.detectedEntryPoints] : [],
      integrationPoints: Array.isArray(overview.integrationPoints) ? [...overview.integrationPoints] : [],
      unknowns: Array.isArray(overview.unknowns) ? [...overview.unknowns] : [],
      executiveBullets: Array.isArray(overview.executiveBullets) ? [...overview.executiveBullets] : [],
      keyModules: Array.isArray(overview.keyModules)
        ? overview.keyModules.map((m) => ({
            ...m,
            dependencies: Array.isArray(m.dependencies) ? [...m.dependencies] : [],
            ...(Array.isArray(m.keyFunctions) ? { keyFunctions: [...m.keyFunctions] } : {}),
          }))
        : [],
      risks: Array.isArray(overview.risks)
        ? overview.risks.map((r) => ({
            ...r,
            ...(Array.isArray(r.sourceReferences)
              ? { sourceReferences: r.sourceReferences.map((sr) => ({ ...sr })) }
              : {}),
            ...(r.provenance ? { provenance: r.provenance } : {}),
            ...(r.bundledPackageName ? { bundledPackageName: r.bundledPackageName } : {}),
          }))
        : [],
      evidence: Array.isArray(overview.evidence) ? overview.evidence.map((e) => ({ ...e })) : [],
      scorecard: overview.scorecard ? { ...overview.scorecard } : overview.scorecard,
      deepDive: overview.deepDive ? { ...overview.deepDive } : overview.deepDive,
      executionFlow: Array.isArray(overview.executionFlow)
        ? overview.executionFlow.map((s) => ({
            ...s,
            files: Array.isArray(s.files) ? [...s.files] : [],
            ...(Array.isArray(s.symbols) ? { symbols: [...s.symbols] } : {}),
          }))
        : undefined,
      dataFlowStages: Array.isArray(overview.dataFlowStages)
        ? overview.dataFlowStages.map((d) => ({
            ...d,
            files: Array.isArray(d.files) ? [...d.files] : [],
            ...(Array.isArray(d.symbols) ? { symbols: [...d.symbols] } : {}),
          }))
        : undefined,
      ...(Array.isArray(overview.analysisLimitations)
        ? { analysisLimitations: [...overview.analysisLimitations] }
        : {}),
      architectureLayers: Array.isArray(overview.architectureLayers)
        ? overview.architectureLayers.map((l) => ({
            ...l,
            modules: Array.isArray(l.modules) ? [...l.modules] : [],
            files: Array.isArray(l.files) ? [...l.files] : [],
          }))
        : undefined,
      detectedTechnologies: Array.isArray(overview.detectedTechnologies)
        ? overview.detectedTechnologies.map((t) => ({
            ...t,
            evidenceSources: [...t.evidenceSources],
            evidence: t.evidence.map((e) => ({ ...e })),
          }))
        : undefined,
      codeMetrics: overview.codeMetrics ? JSON.parse(JSON.stringify(overview.codeMetrics)) : undefined,
    };
  }
}

export const analysisService = new AnalysisService();
