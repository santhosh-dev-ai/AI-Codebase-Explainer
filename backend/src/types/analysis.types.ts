export interface ArchitectureOverview {
  summary: string;
  executiveBullets: string[];
  pattern: string;
  techStack: string[];
  projectType: string;
  framework?: string;
  keyModules: KeyModule[];
  dataFlow: string;
  deepDive: DeepDiveExplanation;
  scorecard: AnalysisScorecard;
  detectedEntryPoints: string[];
  integrationPoints: string[];
  risks: AnalysisRisk[];
  evidence: EvidenceItem[];
  confidence: number;
  unknowns: string[];
  // Canonical fields for consistency across all views
  analysisMode?: 'ai-enriched' | 'deterministic' | 'cached';
  contentHash?: string;
  executionFlow?: ExecutionFlowStep[];
  architectureLayers?: ArchitectureLayer[];
}

export interface ExecutionFlowStep {
  step: number;
  title: string;
  stage: 'entry' | 'route' | 'middleware' | 'controller' | 'service' | 'storage' | 'egress';
  description: string;
  files: string[];
  statusLabel: 'CONFIRMED' | 'INFERRED';
  confidence: number;
}

export interface ArchitectureLayer {
  name: string;
  description: string;
  modules: string[];
  files: string[];
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
  status?: 'CONFIRMED AST' | 'INFERRED RISK';
  whyItMatters?: string;
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
}
