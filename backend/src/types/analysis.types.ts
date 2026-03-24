export interface ArchitectureOverview {
  summary: string;
  pattern: string;
  techStack: string[];
  projectType: string;
  framework?: string;
  keyModules: KeyModule[];
  dataFlow: string;
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
