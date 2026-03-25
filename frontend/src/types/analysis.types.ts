export interface ArchitectureOverview {
  summary: string;
  executiveBullets?: string[];
  pattern: string;
  techStack: string[];
  projectType: string;
  framework?: string;
  keyModules: KeyModule[];
  dataFlow: string;
  deepDive?: DeepDiveExplanation;
  scorecard?: AnalysisScorecard;
  detectedEntryPoints?: string[];
  integrationPoints?: string[];
  risks?: AnalysisRisk[];
  evidence?: EvidenceItem[];
  confidence?: number;
  unknowns?: string[];
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
