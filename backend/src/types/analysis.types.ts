export type TechnologyClassification =
  | 'confirmed-framework'
  | 'confirmed-library'
  | 'probable-framework'
  | 'unverified-manifest';

export type TechnologyEvidenceSource =
  | 'manifest'
  | 'source-import'
  | 'config-file'
  | 'project-structure'
  | 'self-package';

export interface TechnologyEvidenceItem {
  source: TechnologyEvidenceSource;
  filePath: string;
  detail: string;
}

export interface DetectedTechnology {
  name: string;
  category:
    | 'web-framework'
    | 'ui-library'
    | 'http-client'
    | 'data-fetching'
    | 'ml-framework'
    | 'runtime'
    | 'validation'
    | 'library'
    | 'testing'
    | 'build-tool';
  classification: TechnologyClassification;
  ecosystem: 'javascript' | 'typescript' | 'python' | 'multi';
  confidence: number;
  evidenceSources: TechnologyEvidenceSource[];
  evidence: TechnologyEvidenceItem[];
}

export interface ArchitectureOverview {
  summary: string;
  executiveBullets: string[];
  pattern: string;
  techStack: string[];
  projectType: string;
  framework?: string;
  primaryEcosystem?: 'javascript' | 'typescript' | 'python' | 'mixed' | 'unknown';
  detectedTechnologies?: DetectedTechnology[];
  keyModules: KeyModule[];
  dataFlow: string;
  dataFlowStages?: DataFlowStage[];
  deepDive: DeepDiveExplanation;
  scorecard: AnalysisScorecard;
  detectedEntryPoints: string[];
  integrationPoints: string[];
  risks: AnalysisRisk[];
  evidence: EvidenceItem[];
  confidence: number;
  unknowns: string[];
  analysisLimitations?: string[];
  // Canonical fields for consistency across all views
  analysisMode?: 'ai-enriched' | 'deterministic' | 'cached';
  contentHash?: string;
  executionFlow?: ExecutionFlowStep[];
  architectureLayers?: ArchitectureLayer[];
  codeMetrics?: RepositoryMetrics;
}

export type EvidenceTier = 'CONFIRMED' | 'INFERRED' | 'HEURISTIC' | 'UNKNOWN';
export type RiskClassification =
  | 'CONFIRMED_VULNERABILITY'
  | 'CONFIRMED_SINK'
  | 'CONFIRMED'
  | 'INFERRED'
  | 'HEURISTIC';

export interface RiskSourceReference {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
  symbol?: string;
}

export interface DataFlowStage {
  stage: string;
  label: string;
  description: string;
  files: string[];
  symbols?: string[];
  tech?: string;
  classification: EvidenceTier;
  evidence: string;
}

export interface ExecutionFlowStep {
  step: number;
  title: string;
  stage: 'entry' | 'route' | 'middleware' | 'controller' | 'service' | 'storage' | 'egress' | 'compute';
  description: string;
  files: string[];
  symbols?: string[];
  entryPoint?: string;
  evidence?: string;
  detectionMethod?: string;
  statusLabel: EvidenceTier;
  classification?: EvidenceTier;
  confidence: number;
}

export interface ArchitectureLayer {
  name: string;
  description: string;
  modules: string[];
  files: string[];
  classification?: EvidenceTier;
  evidence?: string;
}

export interface DeepDiveExplanation {
  architectureNarrative: string;
  runtimeFlow: string;
  dataLifecycle: string;
  qualitySignals: string;
  scalabilityAndOps: string;
  recommendations: string;
}

export interface AnalysisScorecard {
  architecture: number;
  maintainability: number;
  complexity: number;
  reliability: number;
  security: number;
}

export interface AnalysisRisk {
  title: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
  mitigation: string;
  percentage?: number;
  category?: string;
  evidence?: string;
  filePath?: string;
  confidence?: number;
  status?:
    | 'CONFIRMED AST'
    | 'INFERRED RISK'
    | 'CONFIRMED'
    | 'CONFIRMED_SINK'
    | 'CONFIRMED_VULNERABILITY'
    | 'INFERRED'
    | 'HEURISTIC';
  classification?: RiskClassification;
  detectionMethod?: string;
  sourceReferences?: RiskSourceReference[];
  whyItMatters?: string;
  provenance?: 'first-party' | 'bundled-third-party';
  bundledPackageName?: string;
}

export interface EvidenceItem {
  filePath: string;
  finding: string;
  relevance: string;
}

export interface KeyModule {
  name: string;
  path: string;
  responsibility: string;
  dependencies?: string[];
  relatedModules?: string[];
  keyFunctions?: string[];
  evidence?: string;
}

export interface FileExplanation {
  filePath: string;
  purpose: string;
  keyFunctions: FunctionInfo[];
  dependencies: string[];
  exports: string[];
  patterns: string[];
  complexity: 'low' | 'medium' | 'high';
  analysisMode?: 'ai-enriched' | 'deterministic' | 'cached';
  fallbackReason?: string;
}

export interface FunctionInfo {
  name: string;
  lineStart: number;
  lineEnd: number;
  description: string;
  parameters: string[];
  returns: string;
}

export interface Bug {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  line: number;
  description: string;
  suggestion: string;
  codeSnippet: string;
}

export interface Improvement {
  category: 'performance' | 'security' | 'maintainability' | 'style';
  priority: 'high' | 'medium' | 'low';
  line?: number;
  description: string;
  suggestion: string;
  impact: string;
}

export interface ComplexityMetrics {
  overallScore: number;
  totalFiles: number;
  avgFileSize: number;
  maxDepth: number;
  mostComplexFiles: ComplexFile[];
  languageDistribution: Record<string, number>;
  maintainabilityIndex: number;
}

export interface ComplexFile {
  path: string;
  score: number;
  size: number;
  lines: number;
  reason: string;
}

export type DependencyNodeType =
  | 'entry'
  | 'route'
  | 'controller'
  | 'service'
  | 'component'
  | 'storage'
  | 'ai'
  | 'utility'
  | 'config';

export interface UnresolvedImportEntry {
  sourceFile: string;
  specifier: string;
  reason: 'missing-module' | 'beyond-root' | 'ambiguous' | 'unparsed' | 'non-source-target';
  line?: number;
}

export interface AmbiguousResolutionEntry {
  sourceFile: string;
  specifier: string;
  candidates: string[];
  selected: string;
}

export interface PythonDependencyDiagnostics {
  pythonFilesScanned: number;
  importStatementsExtracted: number;
  internalDependenciesResolved: number;
  externalDependencies: string[];
  stdlibImports: string[];
  unresolvedImports: UnresolvedImportEntry[];
  circularDependencies: string[][];
  ambiguousResolutions: AmbiguousResolutionEntry[];
  manifestsDetected: string[];
}

export interface DependencyGraphNode {
  id: string;
  label: string;
  path: string;
  type: DependencyNodeType;
  description: string;
  imports: string[];
  resolvedImports: string[];
  importedBy: string[];
  exports: string[];
  loc: number;
  status: 'confirmed' | 'inferred';
  layer?: string;
  externalImports?: string[];
  stdlibImports?: string[];
  unresolvedImports?: string[];
}

export interface DependencyGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'dataflow' | 'call';
  label?: string;
  animated?: boolean;
}

export interface DependencyGraphData {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    entryPoints: string[];
    isolatedNodes: number;
    density: number;
  };
  diagnostics?: PythonDependencyDiagnostics;
  circularDependencies?: string[][];
}

export type MetricProvenance = 'measured' | 'estimated' | 'unavailable';

export interface FileLineMetrics {
  filePath: string;
  language: string;
  totalLines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  mixedLines: number;
  cyclomaticComplexity: number | null;
  functionsCount: number;
  classesCount: number;
  complexityStatus: MetricProvenance;
}

export interface LanguageMetric {
  language: string;
  filesCount: number;
  totalLines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  percentage: number;
}

export interface ComplexityFunctionMetric {
  name: string;
  line: number;
  cyclomaticComplexity: number;
}

export interface FileComplexityMetric {
  path: string;
  complexity: number;
  functionsCount: number;
  classesCount: number;
  averageComplexityPerFunction: number;
  status: MetricProvenance;
  functions?: ComplexityFunctionMetric[];
}

export interface ComplexityMetricsSummary {
  status: MetricProvenance;
  measuredFilesCount: number;
  unsupportedFilesCount: number;
  totalFunctionsCount: number;
  totalClassesCount: number;
  averagePerFunction: number;
  averagePerFile: number;
  maxComplexityFile: { path: string; complexity: number } | null;
  distribution: {
    low: number;
    medium: number;
    high: number;
  };
  topComplexFiles: FileComplexityMetric[];
}

export interface TestCaseMetric {
  name: string;
  line: number;
}

export interface TestFileMetric {
  path: string;
  framework: string;
  testCasesCount: number;
  testCases: TestCaseMetric[];
}

export interface TestIntelligenceMetrics {
  testFilesDetected: number;
  testCasesDetected: number;
  testFrameworks: string[];
  testFiles: Array<{
    path: string;
    testCasesCount: number;
    framework: string;
  }>;
  executionStatus: 'not-executed';
  executionNotice: string;
  coverage: {
    available: boolean;
    percentage: number | null;
    reason: string;
    reportFormat?: string;
  };
}

export interface RepositoryMetrics {
  summary: {
    totalSourceFiles: number;
    totalLines: number;
    codeLines: number;
    blankLines: number;
    commentLines: number;
    mixedLines: number;
    locProvenance: MetricProvenance;
  };
  languages: LanguageMetric[];
  complexity: ComplexityMetricsSummary;
  testIntelligence: TestIntelligenceMetrics;
  partiallyAnalyzedOrUnsupported: {
    count: number;
    files: string[];
    reason: string;
  };
  timestamp: string;
}
