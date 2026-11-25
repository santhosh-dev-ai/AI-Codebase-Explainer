import type { Node as FlowNode, Edge as FlowEdge } from 'reactflow';
import { MarkerType } from 'reactflow';
import type { FileNode, RepoMetadata } from '@/types/codebase.types';
import type {
  ArchitectureOverview,
  AnalysisRisk,
  EvidenceItem,
} from '@/types/analysis.types';
import { prettyPrintLanguage } from '@/lib/utils';

export function flattenFileNodes(nodes: FileNode[]): Array<{ path: string }> {
  const files: Array<{ path: string }> = [];

  const walk = (items: FileNode[]) => {
    items.forEach((item) => {
      if (item.type === 'file') {
        files.push({ path: item.path });
      } else if (item.children) {
        walk(item.children);
      }
    });
  };

  walk(nodes);
  return files;
}

export function countDirectories(nodes: FileNode[]): number {
  let count = 0;

  const walk = (items: FileNode[]) => {
    items.forEach((item) => {
      if (item.type === 'directory') {
        count += 1;
        if (item.children) {
          walk(item.children);
        }
      }
    });
  };

  walk(nodes);
  return count;
}

export function inferComplexityByFile(
  overview: ArchitectureOverview | null,
  files: Array<{ path: string }>
): Array<{ path: string; complexity: number }> {
  // If measured AST cyclomatic complexity exists from code metrics engine, use it directly
  if (
    overview?.codeMetrics?.complexity?.topComplexFiles &&
    overview.codeMetrics.complexity.topComplexFiles.length > 0
  ) {
    return overview.codeMetrics.complexity.topComplexFiles.map((cf) => ({
      path: cf.path,
      complexity: cf.complexity,
    }));
  }

  const scoreMap: Record<string, number> = {};

  const bump = (path: string, amount: number) => {
    if (!path) return;
    scoreMap[path] = Math.min(100, (scoreMap[path] || 0) + amount);
  };

  (overview?.evidence || []).forEach((evidence) => {
    let delta = 20;
    const text = `${evidence.finding} ${evidence.relevance}`.toLowerCase();
    if (text.includes('complex')) delta += 25;
    if (text.includes('security')) delta += 10;
    bump(evidence.filePath, delta);
  });

  (overview?.risks || []).forEach((risk) => {
    const severityBoost = risk.severity === 'high' ? 28 : risk.severity === 'medium' ? 18 : 8;
    const related = inferRiskFiles(risk, overview?.evidence || [], files);
    related.forEach((path) => bump(path, severityBoost));
  });

  if (Object.keys(scoreMap).length === 0) {
    // When no AST complexity is measured, default to base McCabe complexity = 1
    files.slice(0, 8).forEach((f) => {
      scoreMap[f.path] = 1;
    });
  }

  return Object.entries(scoreMap)
    .map(([path, complexity]) => ({ path: trimPath(path), complexity }))
    .sort((a, b) => b.complexity - a.complexity);
}

export function inferRiskFiles(
  risk: AnalysisRisk,
  evidence: EvidenceItem[],
  _files: Array<{ path: string }>
): string[] {
  const directFiles: string[] = [];
  if (Array.isArray(risk.sourceReferences)) {
    for (const ref of risk.sourceReferences) {
      if (ref.filePath && !directFiles.includes(ref.filePath)) {
        directFiles.push(ref.filePath);
      }
    }
  }
  if (risk.filePath && risk.filePath !== 'root' && !directFiles.includes(risk.filePath)) {
    directFiles.push(risk.filePath);
  }
  if (directFiles.length > 0) {
    return directFiles.slice(0, 10);
  }

  const tokens = `${risk.title} ${risk.detail}`
    .toLowerCase()
    .split(/[^a-z0-9/_.-]+/)
    .filter((token) => token.length > 4);

  const matched = evidence
    .filter((item) => {
      const blob = `${item.finding} ${item.relevance} ${item.filePath}`.toLowerCase();
      return tokens.some((token) => blob.includes(token));
    })
    .map((item) => item.filePath);

  if (matched.length > 0) {
    return Array.from(new Set(matched)).slice(0, 10);
  }

  // Never fabricate unrelated file associations when no concrete evidence matched
  return [];
}

export function buildArchitectureGraph(steps: string[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const fallbackSteps = steps.length > 0 ? steps : ['Entry (Unmapped)', 'Core Modules'];

  const nodes: FlowNode[] = fallbackSteps.map((step, index) => ({
    id: `${index}`,
    position: { x: 40 + index * 190, y: 90 + ((index % 2) * 40) },
    data: { label: step },
    style: {
      borderRadius: 12,
      border: '1px solid rgba(103, 232, 249, 0.35)',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.75))',
      color: '#e2e8f0',
      padding: '10px 14px',
      boxShadow: '0 0 20px rgba(34,211,238,0.1)',
      fontSize: 11,
      fontWeight: 500,
      width: 150,
      textAlign: 'center',
    },
  }));

  const edges: FlowEdge[] = fallbackSteps.slice(0, -1).map((_, index) => ({
    id: `e-${index}-${index + 1}`,
    source: `${index}`,
    target: `${index + 1}`,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' },
    style: { stroke: '#22d3ee', strokeWidth: 1.5 },
    animated: true,
  }));

  return { nodes, edges };
}

export function trimPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.length <= 26) {
    return normalized;
  }
  return `...${normalized.slice(-26)}`;
}

export function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    typescript: '#3178c6',
    javascript: '#f1e05a',
    python: '#3572a5',
    java: '#b07219',
    html: '#e34c26',
    css: '#663399',
    scss: '#c6538c',
    json: '#64748b',
    markdown: '#0ea5e9',
    go: '#00add8',
    rust: '#dea584',
    ruby: '#701516',
    php: '#4f5d95',
    csharp: '#178600',
    cpp: '#f34b7d',
    c: '#555555',
    shell: '#89e051',
    sql: '#e38c00',
    plaintext: '#64748b',
    vue: '#41b883',
    svelte: '#ff3e00',
    yaml: '#cb171e',
  };

  return colors[language.toLowerCase()] || '#58a6ff';
}

export function seededShuffle<T>(items: T[], seedText: string): T[] {
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }

  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}

export function buildDynamicQuickPrompts({
  sessionId,
  seed,
  metadata,
  overview,
  selectedFilePath,
  highComplexityFiles,
}: {
  sessionId: string;
  seed: number;
  metadata: RepoMetadata | null;
  overview: ArchitectureOverview | null;
  selectedFilePath?: string;
  highComplexityFiles: string[];
}): string[] {
  const repoName = metadata?.name || 'this repository';
  const topLang = metadata
    ? Object.entries(metadata.languages).sort(([, a], [, b]) => b - a)[0]?.[0]
    : undefined;
  const topLangLabel = topLang ? prettyPrintLanguage(topLang) : undefined;
  const firstRisk = overview?.risks?.[0]?.title;
  const firstModule = overview?.keyModules?.[0]?.name;
  const firstEntry = overview?.detectedEntryPoints?.[0];
  const complexityTarget = highComplexityFiles[0];

  const promptPool = [
    `What is ${repoName} mainly responsible for?`,
    selectedFilePath ? `Explain ${selectedFilePath} in simple terms.` : 'Explain the most important file in this repository.',
    firstEntry ? `How does ${firstEntry} connect to the rest of the codebase?` : 'Where is the main entry point and startup flow?',
    firstModule ? `What does the module "${firstModule}" do and why is it important?` : 'Which module contains the core business logic?',
    firstRisk ? `How should we mitigate this risk: ${firstRisk}?` : 'What are the top high-risk areas in this codebase?',
    complexityTarget ? `Why is ${complexityTarget} considered complex and how can we simplify it?` : 'Which files look most complex and why?',
    topLangLabel ? `What ${topLangLabel} patterns are used here, and are they consistent?` : 'What coding patterns are used most in this repository?',
    'Give me a 3-step plan to improve maintainability.',
    'Which files should I read first to understand the full flow?',
    'If I am onboarding today, what should I understand first?',
  ];

  const unique = Array.from(new Set(promptPool.filter(Boolean)));
  const mixed = seededShuffle(unique, `${sessionId}-${seed}`);
  return mixed.slice(0, 4);
}
