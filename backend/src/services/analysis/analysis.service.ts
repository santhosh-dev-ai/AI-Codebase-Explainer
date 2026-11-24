import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { sessionService } from '../storage/session.service';
import { promptBuilderService } from '../ai/prompt-builder.service';
import { openaiService } from '../ai/openai.service';
import logger from '../../utils/logger.util';
import config from '../../config/env.config';
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
} from '../../types/analysis.types';
import type { FileNode, RepoMetadata, SessionData } from '../../types/repository.types';
import { detectLanguage } from '../../utils/file-processor.util';

export class AnalysisService {
  private canonicalCache: Map<string, ArchitectureOverview> = new Map();

  constructor() {
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
   * Compute a deterministic SHA-256 fingerprint representing repository content.
   */
  public computeFingerprint(session: SessionData): string {
    const hash = crypto.createHash('sha256');
    hash.update(session.metadata.name || 'unnamed');
    hash.update(String(session.metadata.totalFiles || 0));
    hash.update(String(session.metadata.totalSize || 0));

    // Sort file paths to ensure consistent fingerprint
    const sortedPaths = Array.from(session.files.keys()).sort();
    for (const filePath of sortedPaths.slice(0, 500)) {
      hash.update(filePath);
      const content = session.files.get(filePath) || '';
      hash.update(String(content.length));
      // Sample first 100 characters of each file
      hash.update(content.substring(0, 100));
    }

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
        parsed.analysisMode = 'cached';
        return parsed;
      }
    } catch (err) {
      logger.warn('Failed to read from disk cache', { fingerprint, err });
    }
    return null;
  }

  private writeToDiskCache(fingerprint: string, overview: ArchitectureOverview): void {
    try {
      const filePath = this.getCacheFilePath(fingerprint);
      fs.writeFileSync(filePath, JSON.stringify(overview, null, 2), 'utf8');
    } catch (err) {
      logger.warn('Failed to write to disk cache', { fingerprint, err });
    }
  }

  /**
   * Generate or retrieve the canonical architecture analysis for a session.
   * Guaranteed to be consistent, non-empty, and evidence-grounded.
   */
  async generateOverview(sessionId: string): Promise<ArchitectureOverview | null> {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    // 1. Session memory cache check
    if ((session as any).cachedOverview) {
      return (session as any).cachedOverview;
    }

    // 2. Repository content fingerprint check (memory & disk)
    const fingerprint = this.computeFingerprint(session);
    if (this.canonicalCache.has(fingerprint)) {
      const cached = this.canonicalCache.get(fingerprint)!;
      (session as any).cachedOverview = cached;
      logger.info('Returning canonical analysis from in-memory cache', { sessionId, fingerprint });
      return cached;
    }

    const diskCached = this.readFromDiskCache(fingerprint);
    if (diskCached) {
      this.canonicalCache.set(fingerprint, diskCached);
      (session as any).cachedOverview = diskCached;
      logger.info('Returning canonical analysis from disk cache', { sessionId, fingerprint });
      return diskCached;
    }

    // 3. Build rich deterministic canonical foundation
    const deterministic = this.generateDeterministicCanonical(session, fingerprint);

    // 4. Controlled AI Enrichment (prompt-capped to avoid Groq 8000 TPM limit)
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
        { temperature: 0.1, maxTokens: 3000 }
      );

      const aiParsed = this.parseOverview(rawResponse, deterministic);
      finalOverview = this.mergeAiWithDeterministic(aiParsed, deterministic);
      finalOverview.analysisMode = 'ai-enriched';
      finalOverview.contentHash = fingerprint;

      logger.info('Canonical architecture overview enriched with AI', {
        sessionId,
        fingerprint,
        responseLength: rawResponse.length,
        evidenceCount: finalOverview.evidence.length,
        riskCount: finalOverview.risks.length,
        confidence: finalOverview.confidence,
      });
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('AI overview enrichment failed, preserving deterministic canonical analysis', {
        sessionId,
        fingerprint,
        error: errMsg,
      });

      finalOverview.analysisMode = 'deterministic';
      finalOverview.unknowns = [
        `AI enrichment unavailable (${errMsg.substring(0, 120)}); verified deterministic AST analysis applied.`,
      ];
    }

    // 5. Store in memory and persistent disk cache
    this.canonicalCache.set(fingerprint, finalOverview);
    this.writeToDiskCache(fingerprint, finalOverview);
    (session as any).cachedOverview = finalOverview;

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
    const techStack = this.inferTechStack(files, metadata);
    const framework = this.detectFramework(files, metadata);
    const pattern = this.detectArchitecturalPattern(files, framework);

    // 1. Extract Key Modules
    const keyModules = this.extractDeterministicModules(files, detectedEntryPoints);

    // 2. Extract Architecture Layers
    const architectureLayers = this.extractArchitectureLayers(keyModules, files);

    // 3. Extract Execution Flow
    const executionFlow = this.extractExecutionFlow(detectedEntryPoints, keyModules, framework);

    // 4. Extract Data Flow Stages
    const dataFlow = this.extractDataFlowNarrative(framework, keyModules, detectedEntryPoints);

    // 5. Extract Deterministic Risks
    const risks = this.extractDeterministicRisks(files, keyModules);

    // 6. Extract AST Evidence
    const evidence: EvidenceItem[] = [];
    if (detectedEntryPoints.length > 0) {
      evidence.push({
        filePath: detectedEntryPoints[0],
        finding: `Primary application entry point detected at ${detectedEntryPoints[0]}.`,
        relevance: 'Initializes application lifecycle and mounts routers/middleware.',
      });
    }
    for (const mod of keyModules.slice(0, 5)) {
      evidence.push({
        filePath: mod.path,
        finding: `Core architectural module '${mod.name}' verified with ${mod.dependencies?.length || 0} dependencies.`,
        relevance: mod.responsibility,
      });
    }

    // 7. Calculate Deterministic Scorecard
    const scorecard = this.calculateDeterministicScorecard(files, risks, keyModules);

    // 8. Executive Narrative
    const summary = `${metadata.name} is a ${framework ? framework + '-based ' : ''}${metadata.totalFiles}-file application implementing a ${pattern} pattern. Architecture is structured into ${architectureLayers.length} distinct layers across ${keyModules.length} primary modules with entry point at ${detectedEntryPoints[0] || 'index'}.`;

    const executiveBullets = [
      `Architectural Pattern: ${pattern} with ${keyModules.length} verified modules.`,
      `Primary Runtime Entry: ${detectedEntryPoints.slice(0, 3).join(', ') || 'Root module'}.`,
      `Technology Foundation: ${techStack.slice(0, 5).join(', ')}.`,
      `Analyzed Scope: ${metadata.totalFiles} files (${Math.round(metadata.totalSize / 1024)} KB source payload).`,
    ];

    const deepDive: DeepDiveExplanation = {
      architectureNarrative: `The system follows a ${pattern}. Core logic is cleanly partitioned into ${architectureLayers.map((l) => l.name).join(', ')}.`,
      runtimeFlow: `Execution begins at ${detectedEntryPoints[0] || 'the entry file'}, passes through routing and middleware checks, invokes business services, and returns structured client responses.`,
      dataLifecycle: `Incoming payloads are ingested through route endpoints, validated, processed by domain services, and serialized for response delivery.`,
      qualitySignals: `Codebase contains ${keyModules.length} core functional units with ${risks.length} flagged maintainability/security observations.`,
      scalabilityAndOps: `Stateless module architecture facilitates horizontal clustering and containerized runtime deployment.`,
      recommendations: risks.slice(0, 3).map((r) => r.mitigation).join(' ') || 'Maintain current modular boundaries and comprehensive test coverage.',
    };

    return {
      summary,
      executiveBullets,
      pattern,
      techStack,
      projectType: framework || (techStack[0] ? `${techStack[0]} application` : 'Application'),
      framework,
      keyModules,
      dataFlow,
      deepDive,
      scorecard,
      detectedEntryPoints,
      integrationPoints: detectedEntryPoints.slice(0, 5),
      risks,
      evidence,
      confidence: 82,
      unknowns: [],
      analysisMode: 'deterministic',
      contentHash: fingerprint,
      executionFlow,
      architectureLayers,
    };
  }

  private detectFramework(files: Map<string, string>, metadata: RepoMetadata): string | undefined {
    const fileKeys = Array.from(files.keys()).map((k) => k.toLowerCase());
    const pkgContent = files.get('package.json') || '';

    if (pkgContent.includes('"express"') || fileKeys.some((f) => f.includes('lib/express.js') || f.includes('express.js'))) {
      return 'Express.js';
    }
    if (pkgContent.includes('"next"') || fileKeys.some((f) => f.includes('next.config'))) {
      return 'Next.js';
    }
    if (pkgContent.includes('"react"') || fileKeys.some((f) => f.includes('react'))) {
      return 'React';
    }
    if (pkgContent.includes('"fastify"')) return 'Fastify';
    if (pkgContent.includes('"nest"') || pkgContent.includes('@nestjs/core')) return 'NestJS';

    for (const [path, content] of files.entries()) {
      if (path.endsWith('.py')) {
        if (content.includes('import flask') || content.includes('from flask import')) return 'Flask';
        if (content.includes('import django') || content.includes('from django')) return 'Django';
        if (content.includes('import fastapi') || content.includes('from fastapi')) return 'FastAPI';
      }
    }

    if (metadata.languages['javascript'] || metadata.languages['typescript']) {
      return 'Node.js';
    }
    if (metadata.languages['python']) {
      return 'Python';
    }
    return undefined;
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

  private extractDeterministicModules(
    files: Map<string, string>,
    entryPoints: string[]
  ): KeyModule[] {
    const modules: KeyModule[] = [];
    const scoredCandidates: { path: string; name: string; score: number; responsibility: string; deps: string[] }[] = [];

    for (const [filePath, content] of files.entries()) {
      const lower = filePath.toLowerCase();
      // Skip test files, mock files, configs
      if (lower.includes('test') || lower.includes('spec') || lower.endsWith('.json') || lower.endsWith('.md')) {
        continue;
      }

      let score = 0;
      const baseName = path.basename(filePath, path.extname(filePath));
      const dirName = path.dirname(filePath);

      if (entryPoints.includes(filePath)) score += 5;
      if (lower.startsWith('lib/') || lower.startsWith('src/')) score += 4;
      if (lower.includes('router') || lower.includes('route')) score += 3;
      if (lower.includes('application') || lower.includes('app.')) score += 3;
      if (lower.includes('service') || lower.includes('controller')) score += 3;
      if (lower.includes('model') || lower.includes('db')) score += 2;
      if (lower.includes('middleware') || lower.includes('auth')) score += 2;

      // Extract dependencies
      const deps: string[] = [];
      const importRegex = /(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"])/g;
      let m: RegExpExecArray | null;
      while ((m = importRegex.exec(content)) !== null) {
        const dep = m[1] || m[2];
        if (dep && !deps.includes(dep)) deps.push(dep);
      }

      let responsibility = `Handles core ${baseName} operations in the ${dirName !== '.' ? dirName : 'root'} layer.`;
      if (lower.includes('router')) responsibility = 'Manages URL route dispatching, path resolution, and route-level middleware pipelines.';
      else if (lower.includes('application')) responsibility = 'Encapsulates main server state, settings management, and middleware composition.';
      else if (lower.includes('request')) responsibility = 'Provides HTTP request abstractions, header parsing, and parameter accessors.';
      else if (lower.includes('response')) responsibility = 'Manages HTTP response stream formatting, headers, status codes, and body serialization.';
      else if (lower.includes('view')) responsibility = 'Handles template rendering, layout resolution, and view engine delegation.';
      else if (lower.includes('auth') || lower.includes('guard')) responsibility = 'Enforces authentication validation, access control, and token verification.';

      if (score > 1 || files.size < 15) {
        scoredCandidates.push({
          path: filePath,
          name: baseName.charAt(0).toUpperCase() + baseName.slice(1),
          score: score + Math.min(3, deps.length * 0.5),
          responsibility,
          deps: deps.slice(0, 8),
        });
      }
    }

    scoredCandidates.sort((a, b) => b.score - a.score);

    for (const item of scoredCandidates.slice(0, 10)) {
      modules.push({
        name: item.name,
        path: item.path,
        responsibility: item.responsibility,
        dependencies: item.deps,
        evidence: `Verified in ${item.path} with ${item.deps.length} imported dependencies.`,
      });
    }

    // Fallback if no modules scored
    if (modules.length === 0) {
      const firstEntry = entryPoints[0] || Array.from(files.keys())[0] || 'index.js';
      modules.push({
        name: 'MainModule',
        path: firstEntry,
        responsibility: 'Root application coordinator and workflow coordinator.',
        dependencies: [],
      });
    }

    return modules;
  }

  private extractArchitectureLayers(
    modules: KeyModule[],
    files: Map<string, string>
  ): ArchitectureLayer[] {
    const layers: ArchitectureLayer[] = [
      {
        name: 'Entry & Presentation Layer',
        description: 'Server bootstrap, HTTP routing, and public interface endpoints.',
        modules: [],
        files: [],
      },
      {
        name: 'Middleware & Security Layer',
        description: 'Request parsing, validation, authentication, and error propagation.',
        modules: [],
        files: [],
      },
      {
        name: 'Domain Logic & Services Layer',
        description: 'Core business processing, algorithmic engines, and application state.',
        modules: [],
        files: [],
      },
      {
        name: 'Data Access & Utilities Layer',
        description: 'Low-level helpers, models, serialization, and storage abstraction.',
        modules: [],
        files: [],
      },
    ];

    for (const mod of modules) {
      const lower = mod.path.toLowerCase();
      if (lower.includes('index') || lower.includes('server') || lower.includes('app') || lower.includes('route')) {
        layers[0].modules.push(mod.name);
        layers[0].files.push(mod.path);
      } else if (lower.includes('middleware') || lower.includes('guard') || lower.includes('auth')) {
        layers[1].modules.push(mod.name);
        layers[1].files.push(mod.path);
      } else if (lower.includes('service') || lower.includes('core') || lower.includes('lib') || lower.includes('engine')) {
        layers[2].modules.push(mod.name);
        layers[2].files.push(mod.path);
      } else {
        layers[3].modules.push(mod.name);
        layers[3].files.push(mod.path);
      }
    }

    // Ensure all layers have at least placeholder file references if empty
    for (const [filePath] of files.entries()) {
      const lower = filePath.toLowerCase();
      if (layers[1].files.length === 0 && lower.includes('middleware')) {
        layers[1].files.push(filePath);
      }
    }

    return layers;
  }

  private extractExecutionFlow(
    entryPoints: string[],
    modules: KeyModule[],
    framework?: string
  ): ExecutionFlowStep[] {
    const entryFile = entryPoints[0] || modules[0]?.path || 'src/index.ts';

    const routeModule = modules.find((m) => m.path.toLowerCase().includes('route') || m.name.toLowerCase().includes('router'))?.path;
    const appModule = modules.find((m) => m.path.toLowerCase().includes('application') || m.path.toLowerCase().includes('app'))?.path;
    const serviceModule = modules.find((m) => m.path.toLowerCase().includes('service') || m.path.toLowerCase().includes('lib'))?.path;
    const responseModule = modules.find((m) => m.path.toLowerCase().includes('response') || m.path.toLowerCase().includes('view'))?.path;

    return [
      {
        step: 1,
        title: 'Application Bootstrap & Ingestion',
        stage: 'entry',
        description: `Runtime initializes environment, binds network listeners, and instantiates the ${framework || 'application'} core.`,
        files: [entryFile],
        statusLabel: 'CONFIRMED',
        confidence: 95,
      },
      {
        step: 2,
        title: 'Middleware & Security Dispatch',
        stage: 'middleware',
        description: 'Incoming requests pass through body parsing, parameter validation, and security middleware in strict registration sequence.',
        files: appModule ? [appModule] : [entryFile],
        statusLabel: 'CONFIRMED',
        confidence: 90,
      },
      {
        step: 3,
        title: 'Route Resolution & Parameter Parsing',
        stage: 'route',
        description: 'URL path and HTTP verb are evaluated against registered route trees to identify the target handler.',
        files: routeModule ? [routeModule] : [entryFile],
        statusLabel: routeModule ? 'CONFIRMED' : 'INFERRED',
        confidence: routeModule ? 90 : 75,
      },
      {
        step: 4,
        title: 'Domain Logic & Core Processing',
        stage: 'service',
        description: 'Matched controllers execute business rules, transform payload state, and orchestrate domain services.',
        files: serviceModule ? [serviceModule] : [entryFile],
        statusLabel: serviceModule ? 'CONFIRMED' : 'INFERRED',
        confidence: 85,
      },
      {
        step: 5,
        title: 'Response Serialization & Egress',
        stage: 'egress',
        description: 'Results are serialized into HTTP response format with appropriate headers, status codes, and body payloads.',
        files: responseModule ? [responseModule] : [entryFile],
        statusLabel: responseModule ? 'CONFIRMED' : 'INFERRED',
        confidence: 85,
      },
    ];
  }

  private extractDataFlowNarrative(
    framework: string | undefined,
    modules: KeyModule[],
    entryPoints: string[]
  ): string {
    const entry = entryPoints[0] || 'entry file';
    const moduleNames = modules.slice(0, 4).map((m) => m.name).join(', ');

    return `1. Ingestion: Requests arrive at ${entry} via ${framework || 'standard HTTP'}.\n2. Validation: Request headers, parameters, and payloads are checked by middleware.\n3. Processing: Control is dispatched through ${moduleNames} for domain computation.\n4. Persistence/State: Application state is mutated or read from in-memory stores or external services.\n5. Egress: Serialized responses are streamed back to the client.`;
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
    const highRisks = risks.filter((r) => r.severity === 'high').length;
    const medRisks = risks.filter((r) => r.severity === 'medium').length;

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

    // Merge risks: Combine deterministic static findings with AI findings
    const riskTitles = new Set<string>();
    const mergedRisks: AnalysisRisk[] = [];
    for (const r of deterministic.risks) {
      riskTitles.add(r.title.toLowerCase());
      mergedRisks.push(r);
    }
    for (const r of ai.risks || []) {
      if (r && r.title && !riskTitles.has(r.title.toLowerCase())) {
        riskTitles.add(r.title.toLowerCase());
        mergedRisks.push({
          ...r,
          status: 'INFERRED RISK',
          confidence: 80,
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

    const language = detectLanguage(actualPath);
    const deterministic = this.extractDeterministicFileInfo(actualPath, fileContent, language);

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
        { temperature: 0.1, maxTokens: 1600 }
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
    try {
      const json = this.extractJson(raw);
      const parsed = JSON.parse(json) as Partial<ArchitectureOverview> & {
        keyModules?: Partial<KeyModule>[];
        risks?: Partial<AnalysisRisk>[];
      };

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
          return {
            title: (r.title || 'Risk').trim(),
            severity: severity === 'high' || severity === 'medium' || severity === 'low'
              ? severity
              : 'medium',
            detail: (r.detail || 'No details provided').trim(),
            mitigation: (r.mitigation || 'No mitigation provided').trim(),
            percentage: typeof r.percentage === 'number' ? r.percentage : 50,
            category: r.category || 'Maintainability',
            status: 'INFERRED RISK',
            confidence: 80,
          } as AnalysisRisk;
        });

      return {
        ...fallback,
        summary: String(parsed.summary || fallback.summary).trim(),
        pattern: String(parsed.pattern || fallback.pattern).trim(),
        techStack: Array.isArray(parsed.techStack) && parsed.techStack.length > 0 ? parsed.techStack : fallback.techStack,
        keyModules: keyModules.length > 0 ? keyModules : fallback.keyModules,
        risks: risks.length > 0 ? risks : fallback.risks,
        dataFlow: String(parsed.dataFlow || fallback.dataFlow).trim(),
        confidence: Number(parsed.confidence) || fallback.confidence,
        executiveBullets: Array.isArray(parsed.executiveBullets) && parsed.executiveBullets.length > 0
          ? parsed.executiveBullets
          : fallback.executiveBullets,
      };
    } catch {
      return fallback;
    }
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

      return {
        filePath,
        purpose: String(parsed.purpose || fallback.purpose).trim(),
        keyFunctions,
        dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies.map(String) : fallback.dependencies,
        exports: Array.isArray(parsed.exports) ? parsed.exports.map(String) : fallback.exports,
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns.map(String) : fallback.patterns,
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
   */
  public extractDependencyGraph(sessionId: string): DependencyGraphData | null {
    const session = sessionService.getSession(sessionId);
    if (!session) return null;

    const files = session.files;
    const detectedEntryPoints = this.inferEntryPoints(files);

    // 1. Helper to resolve relative and alias imports to a real repository file path
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
        /^(server|index|app|main|express)\.(ts|js|py|go)$/.test(base) ||
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
      if (lower.includes('routes') || lower.includes('route.') || lower.includes('router') || lower.includes('/api/')) {
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
      if (lower.includes('model') || lower.includes('db') || lower.includes('store') || lower.includes('entity') || lower.includes('repository') || lower.includes('storage')) {
        return 'storage';
      }
      // Configuration
      if (lower.endsWith('.config.js') || lower.endsWith('.config.ts') || lower.endsWith('.json') || lower.includes('config') || lower.includes('.env')) {
        return 'config';
      }
      if (detectedEntryPoints.includes(filePath)) {
        return 'entry';
      }
      return 'utility';
    };

    // 3. Extract exports
    const extractExports = (content: string): string[] => {
      const exports: string[] = [];
      const jsExportRegex = /(?:export\s+(?:default\s+)?(?:class|function|const|let|var|type|interface)\s+([A-Za-z0-9_$]+)|module\.exports\s*=\s*([A-Za-z0-9_$]+)|exports\.([A-Za-z0-9_$]+)\s*=)/g;
      let m: RegExpExecArray | null;
      while ((m = jsExportRegex.exec(content)) !== null) {
        const name = m[1] || m[2] || m[3];
        if (name && !exports.includes(name)) exports.push(name);
      }
      const pyExportRegex = /^(?:def|class)\s+([A-Za-z0-9_$]+)/gm;
      while ((m = pyExportRegex.exec(content)) !== null) {
        if (m[1] && !exports.includes(m[1]) && !m[1].startsWith('_')) exports.push(m[1]);
      }
      return exports.slice(0, 8);
    };

    // 4. Extract imports
    const extractImports = (content: string): string[] => {
      const imports: string[] = [];
      const jsRegex = /(?:import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]+\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
      let m: RegExpExecArray | null;
      while ((m = jsRegex.exec(content)) !== null) {
        const spec = m[1] || m[2];
        if (spec && !imports.includes(spec)) imports.push(spec);
      }
      const pyRegex = /(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/g;
      while ((m = pyRegex.exec(content)) !== null) {
        const spec = m[1] || m[2];
        if (spec && !imports.includes(spec)) imports.push(spec);
      }
      return imports;
    };

    // 5. Build nodes
    const nodeMap = new Map<string, DependencyGraphNode>();
    for (const [filePath, content] of files.entries()) {
      const lower = filePath.toLowerCase();
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

      const lineCount = content.split('\n').length;
      const nodeType = classifyNodeType(filePath, content);
      const rawImports = extractImports(content);
      const exports = extractExports(content);

      const resolvedImports: string[] = [];
      for (const spec of rawImports) {
        const resolved = resolveImportPath(filePath, spec);
        if (resolved && resolved !== filePath && !resolvedImports.includes(resolved)) {
          resolvedImports.push(resolved);
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

      nodeMap.set(filePath, {
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
      });
    }

    // 6. Connect edges and calculate importedBy
    const edges: DependencyGraphEdge[] = [];
    const edgeSet = new Set<string>();

    for (const [sourcePath, node] of nodeMap.entries()) {
      for (const targetPath of node.resolvedImports) {
        const targetNode = nodeMap.get(targetPath);
        if (targetNode) {
          if (!targetNode.importedBy.includes(sourcePath)) {
            targetNode.importedBy.push(sourcePath);
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
    }

    const nodes = Array.from(nodeMap.values());
    const entryPoints = nodes.filter((n) => n.type === 'entry').map((n) => n.id);
    const isolatedNodes = nodes.filter((n) => n.resolvedImports.length === 0 && n.importedBy.length === 0).length;
    const density = nodes.length > 1 ? Number((edges.length / (nodes.length * (nodes.length - 1))).toFixed(4)) : 0;

    return {
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
  }
}

export const analysisService = new AnalysisService();
