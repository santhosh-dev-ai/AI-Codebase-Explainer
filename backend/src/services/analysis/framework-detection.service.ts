import path from 'path';
import type {
  DetectedTechnology,
  TechnologyClassification,
  TechnologyEvidenceItem,
  TechnologyEvidenceSource,
} from '../../types/analysis.types';
import type { RepoMetadata } from '../../types/repository.types';
import { pythonDependencyService } from './python-dependency.service';

export interface FrameworkDetectionResult {
  primaryFramework?: string;
  projectType: string;
  primaryEcosystem: 'javascript' | 'typescript' | 'python' | 'mixed' | 'unknown';
  technologies: DetectedTechnology[];
  techStack: string[];
}

interface PackageJsonInfo {
  name: string;
  prodDeps: Set<string>;
  peerDeps: Set<string>;
  devDeps: Set<string>;
  optionalDeps: Set<string>;
}

interface PythonManifestInfo {
  packageNames: Set<string>;
  prodDeps: Set<string>;
  optionalDeps: Set<string>;
  manifestFiles: string[];
}

interface TechRule {
  name: string;
  category: DetectedTechnology['category'];
  isFramework: boolean;
  ecosystem: 'javascript' | 'typescript' | 'python';
  priority: number;
  npmPackages?: string[];
  pyPackages?: string[];
  rootConfigs?: RegExp[];
  structureMatcher?: (ctx: DetectionContext) => TechnologyEvidenceItem[];
  selfPackageMatcher?: (ctx: DetectionContext) => TechnologyEvidenceItem[];
}

interface DetectionContext {
  files: Map<string, string>;
  normalizedPaths: string[];
  coreJsFiles: Array<[string, string]>;
  corePyFiles: Array<[string, string]>;
  rootPkg: PackageJsonInfo | null;
  pyManifest: PythonManifestInfo;
  coreJsImportsByPkg: Map<string, string[]>;
  corePyImportsByPkg: Map<string, string[]>;
  inferredJsTsEcosystem: 'javascript' | 'typescript';
}

const SECONDARY_DIR_REGEX =
  /(^|\/)(examples?|docs?|doc|docs_src|cookbook|externals?|vendored?|third_party|benchmarks?|fixtures?|mocks?|__mocks__|__tests__|tests?|spec|e2e|demo|samples?)(\/|$)/i;

function isSecondaryPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  if (SECONDARY_DIR_REGEX.test(lower)) return true;
  if (
    base.startsWith('test_') ||
    base.endsWith('_test.py') ||
    base.includes('.test.') ||
    base.includes('.spec.') ||
    base === 'conftest.py'
  ) {
    return true;
  }
  return false;
}

const TECH_RULES: TechRule[] = [
  {
    name: 'Next.js',
    category: 'web-framework',
    isFramework: true,
    ecosystem: 'typescript',
    priority: 100,
    npmPackages: ['next'],
    rootConfigs: [/^next\.config\.(js|mjs|ts|cjs)$/i],
    structureMatcher: (ctx) => {
      const matches: TechnologyEvidenceItem[] = [];
      const nextAppPaths = ctx.normalizedPaths.filter(
        (p) =>
          !isSecondaryPath(p) &&
          (/^(src\/)?app\/(layout|page|route)\.(tsx|jsx|ts|js)$/i.test(p) ||
            /^(src\/)?pages\/(_app|_document|index)\.(tsx|jsx|ts|js)$/i.test(p))
      );
      if (nextAppPaths.length > 0 && (ctx.rootPkg?.prodDeps.has('next') || ctx.coreJsImportsByPkg.has('next'))) {
        matches.push({
          source: 'project-structure',
          filePath: nextAppPaths[0],
          detail: `Next.js App/Pages Router convention detected (${nextAppPaths.slice(0, 3).join(', ')})`,
        });
      }
      return matches;
    },
    selfPackageMatcher: (ctx) => {
      if (ctx.rootPkg?.name === 'next' && ctx.normalizedPaths.some((p) => p.startsWith('packages/next/'))) {
        return [{ source: 'self-package', filePath: 'package.json', detail: 'Root package.json identifies next repository' }];
      }
      return [];
    },
  },
  {
    name: 'NestJS',
    category: 'web-framework',
    isFramework: true,
    ecosystem: 'typescript',
    priority: 95,
    npmPackages: ['@nestjs/core', '@nestjs/common'],
    rootConfigs: [/^nest-cli\.json$/i],
    structureMatcher: (ctx) => {
      for (const [p, content] of ctx.coreJsFiles) {
        if (/@(Module|Controller|Injectable)\s*\(/.test(content) && ctx.coreJsImportsByPkg.has('@nestjs/common')) {
          return [{ source: 'project-structure', filePath: p, detail: 'NestJS decorator pattern (@Module/@Controller/@Injectable)' }];
        }
      }
      return [];
    },
  },
  {
    name: 'Express.js',
    category: 'web-framework',
    isFramework: true,
    ecosystem: 'javascript',
    priority: 90,
    npmPackages: ['express'],
    selfPackageMatcher: (ctx) => {
      const hasLibExpress = ctx.files.has('lib/express.js') && ctx.files.has('lib/application.js');
      if (ctx.rootPkg?.name === 'express' || hasLibExpress) {
        return [{
          source: 'self-package',
          filePath: hasLibExpress ? 'lib/express.js' : 'package.json',
          detail: 'Implements Express application/router core',
        }];
      }
      return [];
    },
    structureMatcher: (ctx) => {
      if (!ctx.coreJsImportsByPkg.has('express') && !ctx.rootPkg?.prodDeps.has('express')) return [];
      const matched: TechnologyEvidenceItem[] = [];
      for (const [p, content] of ctx.coreJsFiles) {
        if (/\bexpress\s*\(\s*\)/.test(content) || /\bexpress\.Router\s*\(/.test(content)) {
          matched.push({
            source: 'project-structure',
            filePath: p,
            detail: 'Instantiates express() app or express.Router()',
          });
          break;
        }
      }
      return matched;
    },
  },
  {
    name: 'Fastify',
    category: 'web-framework',
    isFramework: true,
    ecosystem: 'typescript',
    priority: 88,
    npmPackages: ['fastify'],
    structureMatcher: (ctx) => {
      if (!ctx.coreJsImportsByPkg.has('fastify') && !ctx.rootPkg?.prodDeps.has('fastify')) return [];
      for (const [p, content] of ctx.coreJsFiles) {
        if (/\bfastify\s*\(/i.test(content)) {
          return [{ source: 'project-structure', filePath: p, detail: 'Instantiates Fastify server instance' }];
        }
      }
      return [];
    },
  },
  {
    name: 'FastAPI',
    category: 'web-framework',
    isFramework: true,
    ecosystem: 'python',
    priority: 92,
    pyPackages: ['fastapi'],
    selfPackageMatcher: (ctx) => {
      if (ctx.pyManifest.packageNames.has('fastapi') || ctx.files.has('fastapi/applications.py')) {
        return [{
          source: 'self-package',
          filePath: ctx.files.has('fastapi/applications.py') ? 'fastapi/applications.py' : 'pyproject.toml',
          detail: 'Implements FastAPI core framework',
        }];
      }
      return [];
    },
    structureMatcher: (ctx) => {
      if (!ctx.corePyImportsByPkg.has('fastapi') && !ctx.pyManifest.prodDeps.has('fastapi')) return [];
      for (const [p, content] of ctx.corePyFiles) {
        if (/\bFastAPI\s*\(/.test(content) || /\bAPIRouter\s*\(/.test(content)) {
          return [{ source: 'project-structure', filePath: p, detail: 'Instantiates FastAPI() or APIRouter()' }];
        }
      }
      return [];
    },
  },
  {
    name: 'Flask',
    category: 'web-framework',
    isFramework: true,
    ecosystem: 'python',
    priority: 90,
    pyPackages: ['flask'],
    selfPackageMatcher: (ctx) => {
      const hasSansioApp = ctx.files.has('src/flask/sansio/app.py');
      if (ctx.pyManifest.packageNames.has('flask') || hasSansioApp) {
        return [{
          source: 'self-package',
          filePath: hasSansioApp ? 'src/flask/app.py' : 'pyproject.toml',
          detail: 'Implements Flask WSGI application package',
        }];
      }
      return [];
    },
    structureMatcher: (ctx) => {
      if (!ctx.corePyImportsByPkg.has('flask') && !ctx.pyManifest.prodDeps.has('flask')) return [];
      for (const [p, content] of ctx.corePyFiles) {
        if (/\bFlask\s*\(/.test(content) || /\bBlueprint\s*\(/.test(content)) {
          return [{ source: 'project-structure', filePath: p, detail: 'Instantiates Flask() application or Blueprint()' }];
        }
      }
      return [];
    },
  },
  {
    name: 'Django',
    category: 'web-framework',
    isFramework: true,
    ecosystem: 'python',
    priority: 89,
    pyPackages: ['django'],
    rootConfigs: [/^manage\.py$/i],
    selfPackageMatcher: (ctx) => {
      if (ctx.pyManifest.packageNames.has('django') && ctx.files.has('django/core/wsgi.py')) {
        return [{ source: 'self-package', filePath: 'django/core/wsgi.py', detail: 'Implements Django web framework' }];
      }
      return [];
    },
    structureMatcher: (ctx) => {
      const settingsOrUrls = ctx.normalizedPaths.find(
        (p) => !isSecondaryPath(p) && (/\/settings\.py$/i.test(p) || /\/urls\.py$/i.test(p) || p === 'settings.py' || p === 'urls.py')
      );
      if (settingsOrUrls && (ctx.corePyImportsByPkg.has('django') || ctx.pyManifest.prodDeps.has('django'))) {
        return [{ source: 'project-structure', filePath: settingsOrUrls, detail: 'Django settings.py/urls.py module layout' }];
      }
      return [];
    },
  },
  {
    name: 'Axios',
    category: 'http-client',
    isFramework: false,
    ecosystem: 'javascript',
    priority: 85,
    npmPackages: ['axios'],
    selfPackageMatcher: (ctx) => {
      const hasAxiosCore = ctx.files.has('lib/core/Axios.js') || ctx.files.has('lib/axios.js');
      if (ctx.rootPkg?.name === 'axios' || hasAxiosCore) {
        return [{
          source: 'self-package',
          filePath: ctx.files.has('lib/core/Axios.js') ? 'lib/core/Axios.js' : 'package.json',
          detail: 'Implements Axios HTTP client library',
        }];
      }
      return [];
    },
  },
  {
    name: 'SWR',
    category: 'data-fetching',
    isFramework: false,
    ecosystem: 'typescript',
    priority: 85,
    npmPackages: ['swr'],
    selfPackageMatcher: (ctx) => {
      const hasSwrCore =
        ctx.files.has('src/index/use-swr.ts') ||
        ctx.files.has('src/core/use-swr.ts') ||
        ctx.files.has('core/src/use-swr.ts');
      if (ctx.rootPkg?.name === 'swr' || hasSwrCore) {
        return [{
          source: 'self-package',
          filePath: hasSwrCore ? (ctx.files.has('src/index/use-swr.ts') ? 'src/index/use-swr.ts' : 'src/core/use-swr.ts') : 'package.json',
          detail: 'Implements SWR React data-fetching hook library',
        }];
      }
      return [];
    },
  },
  {
    name: 'Scikit-learn',
    category: 'ml-framework',
    isFramework: false,
    ecosystem: 'python',
    priority: 86,
    pyPackages: ['scikit-learn', 'sklearn'],
    selfPackageMatcher: (ctx) => {
      const hasSklearnCore = ctx.files.has('sklearn/__init__.py') || ctx.files.has('sklearn/base.py');
      if (ctx.pyManifest.packageNames.has('scikit-learn') || hasSklearnCore) {
        return [{
          source: 'self-package',
          filePath: hasSklearnCore ? 'sklearn/__init__.py' : 'pyproject.toml',
          detail: 'Implements scikit-learn Python machine learning package',
        }];
      }
      return [];
    },
  },
  {
    name: 'React',
    category: 'ui-library',
    isFramework: false,
    ecosystem: 'typescript',
    priority: 75,
    npmPackages: ['react', 'react-dom'],
    selfPackageMatcher: (ctx) => {
      if (ctx.rootPkg?.name === 'react' && ctx.files.has('packages/react/src/React.js')) {
        return [{ source: 'self-package', filePath: 'packages/react/src/React.js', detail: 'Implements React library' }];
      }
      return [];
    },
  },
  {
    name: 'Vite',
    category: 'build-tool',
    isFramework: false,
    ecosystem: 'typescript',
    priority: 65,
    npmPackages: ['vite'],
    rootConfigs: [/^vite\.config\.(ts|js|mjs|mts)$/i],
  },
  {
    name: 'PyTorch',
    category: 'ml-framework',
    isFramework: false,
    ecosystem: 'python',
    priority: 72,
    pyPackages: ['torch', 'pytorch'],
  },
  {
    name: 'micrograd',
    category: 'ml-framework',
    isFramework: false,
    ecosystem: 'python',
    priority: 78,
    pyPackages: ['micrograd'],
    selfPackageMatcher: (ctx) => {
      if (ctx.pyManifest.packageNames.has('micrograd') || (ctx.files.has('micrograd/engine.py') && ctx.files.has('micrograd/nn.py'))) {
        return [{ source: 'self-package', filePath: 'micrograd/engine.py', detail: 'Implements micrograd autograd and neural network library' }];
      }
      return [];
    },
  },
];

class FrameworkDetectionService {
  public detect(files: Map<string, string>, metadata: RepoMetadata): FrameworkDetectionResult {
    const normalizedFiles = new Map<string, string>();
    const normalizedPaths: string[] = [];
    for (const [rawPath, content] of files.entries()) {
      const norm = pythonDependencyService.normalizePath(rawPath);
      normalizedFiles.set(norm, content);
      normalizedPaths.push(norm);
    }

    const coreJsFiles: Array<[string, string]> = [];
    const corePyFiles: Array<[string, string]> = [];
    let allPyCount = 0;
    let allJsTsCount = 0;
    let tsFileCount = 0;
    let jsFileCount = 0;

    for (const [normPath, content] of normalizedFiles.entries()) {
      const lower = normPath.toLowerCase();
      const isPy = lower.endsWith('.py') || lower.endsWith('.pyi');
      const isTs = lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.mts') || lower.endsWith('.cts');
      const isJs = lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs');

      if (isPy) allPyCount++;
      if (isTs) { allJsTsCount++; tsFileCount++; }
      if (isJs) { allJsTsCount++; jsFileCount++; }

      if (isSecondaryPath(normPath)) continue;
      if (isPy) corePyFiles.push([normPath, content]);
      if (isTs || isJs) coreJsFiles.push([normPath, content]);
    }

    const rootPkg = this.parseRootPackageJson(normalizedFiles.get('package.json'));
    const pyManifest = this.parsePythonManifests(normalizedFiles);
    const coreJsImportsByPkg = this.extractCoreJsImports(coreJsFiles);
    const corePyImportsByPkg = this.extractCorePyImports(corePyFiles);

    const inferredJsTsEcosystem: 'javascript' | 'typescript' =
      tsFileCount >= jsFileCount && tsFileCount > 0 ? 'typescript' : 'javascript';

    const ctx: DetectionContext = {
      files: normalizedFiles,
      normalizedPaths,
      coreJsFiles,
      corePyFiles,
      rootPkg,
      pyManifest,
      coreJsImportsByPkg,
      corePyImportsByPkg,
      inferredJsTsEcosystem,
    };

    const technologies: DetectedTechnology[] = [];

    for (const rule of TECH_RULES) {
      const evidence: TechnologyEvidenceItem[] = [];
      let hasProdManifest = false;
      let hasPeerOrOptManifest = false;
      let hasSelfPkg = false;
      let coreImportCount = 0;
      let hasRootConfig = false;
      let hasStructure = false;

      // 1. Self-package signal
      if (rule.selfPackageMatcher) {
        const selfEv = rule.selfPackageMatcher(ctx);
        if (selfEv.length > 0) {
          hasSelfPkg = true;
          evidence.push(...selfEv);
        }
      }

      // 2. Root manifest signal (explicit exact package identity only)
      if (rule.npmPackages && rootPkg) {
        for (const npmPkg of rule.npmPackages) {
          if (rootPkg.prodDeps.has(npmPkg)) {
            hasProdManifest = true;
            evidence.push({
              source: 'manifest',
              filePath: 'package.json',
              detail: `Declared in root dependencies: "${npmPkg}"`,
            });
          } else if (rootPkg.peerDeps.has(npmPkg) || rootPkg.optionalDeps.has(npmPkg)) {
            hasPeerOrOptManifest = true;
            evidence.push({
              source: 'manifest',
              filePath: 'package.json',
              detail: `Declared in root peer/optionalDependencies: "${npmPkg}"`,
            });
          }
          // Notice: rootPkg.devDeps is intentionally NOT promoted into framework evidence
        }
      }

      if (rule.pyPackages) {
        for (const pyPkg of rule.pyPackages) {
          if (pyManifest.prodDeps.has(pyPkg)) {
            hasProdManifest = true;
            evidence.push({
              source: 'manifest',
              filePath: pyManifest.manifestFiles[0] || 'pyproject.toml',
              detail: `Declared in Python runtime manifest: "${pyPkg}"`,
            });
          } else if (pyManifest.optionalDeps.has(pyPkg)) {
            hasPeerOrOptManifest = true;
            evidence.push({
              source: 'manifest',
              filePath: pyManifest.manifestFiles[0] || 'pyproject.toml',
              detail: `Declared in Python optional manifest: "${pyPkg}"`,
            });
          }
        }
      }

      // 3. Core source imports (non-example, non-test, non-doc)
      if (rule.npmPackages) {
        const importingFiles = new Set<string>();
        for (const npmPkg of rule.npmPackages) {
          const hitFiles = coreJsImportsByPkg.get(npmPkg) || [];
          for (const f of hitFiles) importingFiles.add(f);
        }
        coreImportCount += importingFiles.size;
        if (importingFiles.size > 0) {
          const sample = Array.from(importingFiles).slice(0, 3);
          evidence.push({
            source: 'source-import',
            filePath: sample[0],
            detail: `Imported in ${importingFiles.size} core JS/TS file(s): ${sample.join(', ')}`,
          });
        }
      }

      if (rule.pyPackages) {
        const importingFiles = new Set<string>();
        for (const pyPkg of rule.pyPackages) {
          const hitFiles = corePyImportsByPkg.get(pyPkg) || [];
          for (const f of hitFiles) importingFiles.add(f);
        }
        coreImportCount += importingFiles.size;
        if (importingFiles.size > 0) {
          const sample = Array.from(importingFiles).slice(0, 3);
          evidence.push({
            source: 'source-import',
            filePath: sample[0],
            detail: `Imported in ${importingFiles.size} core Python file(s): ${sample.join(', ')}`,
          });
        }
      }

      // 4. Root configuration files (never examples/ or docs/)
      if (rule.rootConfigs) {
        for (const normPath of normalizedPaths) {
          if (isSecondaryPath(normPath)) continue;
          if (rule.rootConfigs.some((re) => re.test(normPath))) {
            hasRootConfig = true;
            evidence.push({
              source: 'config-file',
              filePath: normPath,
              detail: `Root framework configuration file: ${normPath}`,
            });
            break;
          }
        }
      }

      // 5. Project structure & instantiation
      if (rule.structureMatcher) {
        const structEv = rule.structureMatcher(ctx);
        if (structEv.length > 0) {
          hasStructure = true;
          evidence.push(...structEv);
        }
      }

      if (evidence.length === 0) continue;

      // Determine classification strictly from verified evidence (no manifest-only inflation)
      let classification: TechnologyClassification;
      const hasAnyManifest = hasProdManifest || hasPeerOrOptManifest;
      const runtimeSignalsCount =
        (coreImportCount > 0 ? 1 : 0) + (hasRootConfig ? 1 : 0) + (hasStructure ? 1 : 0);

      if (hasSelfPkg) {
        classification = rule.isFramework ? 'confirmed-framework' : 'confirmed-library';
      } else if (hasAnyManifest && runtimeSignalsCount > 0) {
        classification = rule.isFramework ? 'confirmed-framework' : 'confirmed-library';
      } else if (!hasAnyManifest && coreImportCount > 0) {
        classification = rule.isFramework
          ? runtimeSignalsCount >= 2 || coreImportCount >= 2
            ? 'probable-framework'
            : 'probable-framework'
          : 'confirmed-library';
      } else if (hasRootConfig && hasStructure) {
        classification = rule.isFramework ? 'probable-framework' : 'confirmed-library';
      } else if (hasAnyManifest && runtimeSignalsCount === 0) {
        classification = 'unverified-manifest';
      } else if (hasRootConfig) {
        classification = rule.isFramework ? 'probable-framework' : 'confirmed-library';
      } else {
        continue;
      }

      // Compute deterministic confidence rubric strictly from observed signals
      let confidence = 0;
      if (hasSelfPkg) confidence += 45;
      if (hasProdManifest) confidence += 25;
      else if (hasPeerOrOptManifest) confidence += 15;
      if (coreImportCount >= 2) confidence += 35;
      else if (coreImportCount === 1) confidence += 25;
      if (hasRootConfig) confidence += 25;
      if (hasStructure) confidence += 20;
      confidence = Math.min(98, Math.max(15, confidence));

      // Guardrail: unverified-manifest never gets high confidence
      if (classification === 'unverified-manifest') {
        confidence = Math.min(35, confidence);
      }

      const evidenceSources = Array.from(new Set<TechnologyEvidenceSource>(evidence.map((e) => e.source)));
      const techEcosystem: DetectedTechnology['ecosystem'] =
        rule.ecosystem === 'python'
          ? 'python'
          : inferredJsTsEcosystem;

      technologies.push({
        name: rule.name,
        category: rule.category,
        classification,
        ecosystem: techEcosystem,
        confidence,
        evidenceSources,
        evidence,
      });
    }

    // Sort strongest confirmed frameworks/libraries first
    const tierWeight: Record<TechnologyClassification, number> = {
      'confirmed-framework': 4,
      'confirmed-library': 3,
      'probable-framework': 2,
      'unverified-manifest': 1,
    };
    technologies.sort((a, b) => {
      const td = tierWeight[b.classification] - tierWeight[a.classification];
      if (td !== 0) return td;
      const bSelf = b.evidenceSources.includes('self-package') ? 1 : 0;
      const aSelf = a.evidenceSources.includes('self-package') ? 1 : 0;
      if (bSelf !== aSelf) return bSelf - aSelf;
      return b.confidence - a.confidence;
    });

    const primaryEcosystem = this.resolvePrimaryEcosystem(
      corePyFiles.length,
      coreJsFiles.length,
      allPyCount,
      allJsTsCount,
      tsFileCount,
      jsFileCount,
      technologies,
      metadata
    );

    const confirmedFw = technologies.find((t) => t.classification === 'confirmed-framework');
    const probableFw = technologies.find((t) => t.classification === 'probable-framework');
    const primaryFramework = confirmedFw?.name || probableFw?.name;

    const primaryConfirmedLib = technologies.find((t) => t.classification === 'confirmed-library');
    const projectType = this.formatProjectType(primaryFramework, primaryConfirmedLib, primaryEcosystem);

    const techStack = this.buildTechStack(technologies, primaryEcosystem, normalizedFiles);

    return {
      primaryFramework,
      projectType,
      primaryEcosystem,
      technologies,
      techStack,
    };
  }

  private resolvePrimaryEcosystem(
    corePyCount: number,
    coreJsCount: number,
    allPyCount: number,
    allJsTsCount: number,
    tsCount: number,
    jsCount: number,
    technologies: DetectedTechnology[],
    metadata: RepoMetadata
  ): FrameworkDetectionResult['primaryEcosystem'] {
    const activePy = technologies.some((t) => t.ecosystem === 'python' && t.classification !== 'unverified-manifest');
    const activeJs = technologies.some(
      (t) => (t.ecosystem === 'javascript' || t.ecosystem === 'typescript') && t.classification !== 'unverified-manifest'
    );

    if (activePy && activeJs) return 'mixed';
    if (corePyCount > 0 && coreJsCount > 0) {
      const minRatio = Math.min(corePyCount, coreJsCount) / (corePyCount + coreJsCount);
      if (minRatio >= 0.2) return 'mixed';
    }

    if (corePyCount > coreJsCount) return 'python';
    if (coreJsCount > corePyCount) return tsCount >= jsCount && tsCount > 0 ? 'typescript' : 'javascript';

    if (allPyCount > allJsTsCount) return 'python';
    if (allJsTsCount > allPyCount) return tsCount >= jsCount && tsCount > 0 ? 'typescript' : 'javascript';

    if (metadata.languages['python']) return 'python';
    if (metadata.languages['typescript']) return 'typescript';
    if (metadata.languages['javascript']) return 'javascript';
    return 'unknown';
  }

  private formatProjectType(
    primaryFramework: string | undefined,
    primaryLib: DetectedTechnology | undefined,
    ecosystem: FrameworkDetectionResult['primaryEcosystem']
  ): string {
    if (primaryFramework) {
      return ecosystem === 'mixed' ? `${primaryFramework} (Full-Stack)` : `${primaryFramework} Application`;
    }
    if (primaryLib) {
      const categoryLabels: Record<string, string> = {
        'http-client': 'HTTP Client Library',
        'data-fetching': 'Data-Fetching Library',
        'ml-framework': 'Machine Learning Library',
        'ui-library': 'UI Component Library',
        'build-tool': 'Build Tool',
      };
      const catLabel = categoryLabels[primaryLib.category] || 'Library';
      return `${catLabel} (${primaryLib.name})`;
    }
    const ecoLabel =
      ecosystem === 'python'
        ? 'Python'
        : ecosystem === 'typescript'
        ? 'TypeScript'
        : ecosystem === 'javascript'
        ? 'JavaScript'
        : ecosystem === 'mixed'
        ? 'Multi-Language'
        : 'Software';
    return `${ecoLabel} Project`;
  }

  private buildTechStack(
    technologies: DetectedTechnology[],
    ecosystem: FrameworkDetectionResult['primaryEcosystem'],
    files: Map<string, string>
  ): string[] {
    const stack = new Set<string>();

    if (ecosystem === 'python' || ecosystem === 'mixed') stack.add('Python');
    if (ecosystem === 'typescript' || ecosystem === 'mixed') stack.add('TypeScript');
    if (ecosystem === 'javascript') stack.add('JavaScript');

    for (const tech of technologies) {
      if (tech.classification !== 'unverified-manifest') {
        stack.add(tech.name);
      }
    }

    if (files.has('package.json') && ecosystem !== 'python') stack.add('Node.js');
    for (const p of files.keys()) {
      const lower = p.toLowerCase();
      if (lower.endsWith('dockerfile') || lower.includes('docker-compose')) stack.add('Docker');
    }

    return Array.from(stack);
  }

  private parseRootPackageJson(raw: string | undefined): PackageJsonInfo | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        name?: unknown;
        dependencies?: Record<string, unknown>;
        peerDependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
        optionalDependencies?: Record<string, unknown>;
      };
      if (!parsed || typeof parsed !== 'object') return null;

      return {
        name: typeof parsed.name === 'string' ? parsed.name.trim().toLowerCase() : '',
        prodDeps: new Set(Object.keys(parsed.dependencies || {}).map((k) => k.trim().toLowerCase())),
        peerDeps: new Set(Object.keys(parsed.peerDependencies || {}).map((k) => k.trim().toLowerCase())),
        devDeps: new Set(Object.keys(parsed.devDependencies || {}).map((k) => k.trim().toLowerCase())),
        optionalDeps: new Set(Object.keys(parsed.optionalDependencies || {}).map((k) => k.trim().toLowerCase())),
      };
    } catch {
      return null;
    }
  }

  private parsePythonManifests(files: Map<string, string>): PythonManifestInfo {
    const packageNames = new Set<string>();
    const prodDeps = new Set<string>();
    const optionalDeps = new Set<string>();
    const manifestFiles: string[] = [];

    const addPkg = (raw: string, targetSet: Set<string>) => {
      const cleaned = raw
        .trim()
        .replace(/\[[^\]]*\]/g, '')
        .replace(/[<>=!~;\s].*$/, '')
        .toLowerCase();
      if (cleaned && /^[a-z0-9][a-z0-9._-]*$/.test(cleaned)) {
        targetSet.add(cleaned);
        if (cleaned === 'scikit-learn') targetSet.add('sklearn');
      }
    };

    for (const [filePath, content] of files.entries()) {
      const lower = filePath.toLowerCase();
      const base = path.basename(lower);
      if (isSecondaryPath(filePath)) continue;

      if (base === 'pyproject.toml') {
        manifestFiles.push(filePath);
        const nameMatch = content.match(/\[(?:project|tool\.poetry)\][\s\S]*?^\s*name\s*=\s*["']([^"']+)["']/m);
        if (nameMatch?.[1]) packageNames.add(nameMatch[1].trim().toLowerCase());

        // Root dependencies = [...] before [project.optional-dependencies]
        const depsMatch = content.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/gm);
        if (depsMatch) {
          for (const block of depsMatch) {
            const strRe = /["']([^"']+)["']/g;
            let m: RegExpExecArray | null;
            while ((m = strRe.exec(block)) !== null) addPkg(m[1], prodDeps);
          }
        }
        const poetryDeps = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/i);
        if (poetryDeps?.[1]) {
          for (const line of poetryDeps[1].split(/\r?\n/)) {
            const kv = line.match(/^\s*([A-Za-z0-9._-]+)\s*=/);
            if (kv?.[1] && kv[1].toLowerCase() !== 'python') addPkg(kv[1], prodDeps);
          }
        }
        const optSection = content.match(/\[project\.optional-dependencies\]([\s\S]*?)(?=\n\[|$)/gi);
        if (optSection) {
          for (const sec of optSection) {
            const strRe = /["']([^"']+)["']/g;
            let m: RegExpExecArray | null;
            while ((m = strRe.exec(sec)) !== null) addPkg(m[1], optionalDeps);
          }
        }
      } else if (base === 'setup.py') {
        manifestFiles.push(filePath);
        const nameMatch = content.match(/setup\s*\([\s\S]*?name\s*=\s*["']([^"']+)["']/);
        if (nameMatch?.[1]) packageNames.add(nameMatch[1].trim().toLowerCase());

        const reqMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
        if (reqMatch?.[1]) {
          const strRe = /["']([^"']+)["']/g;
          let m: RegExpExecArray | null;
          while ((m = strRe.exec(reqMatch[1])) !== null) addPkg(m[1], prodDeps);
        }
      } else if (base === 'setup.cfg') {
        manifestFiles.push(filePath);
        const nameMatch = content.match(/\[metadata\][\s\S]*?^\s*name\s*=\s*([^\n#]+)/m);
        if (nameMatch?.[1]) packageNames.add(nameMatch[1].trim().toLowerCase());

        const reqMatch = content.match(/install_requires\s*=([\s\S]*?)(?:\n[A-Za-z_]+\s*=|\n\[|$)/i);
        if (reqMatch?.[1]) {
          for (const line of reqMatch[1].split(/\r?\n/)) {
            const c = line.replace(/#.*$/, '').trim();
            if (c) addPkg(c, prodDeps);
          }
        }
      } else if (base === 'requirements.txt') {
        manifestFiles.push(filePath);
        for (const line of content.split(/\r?\n/)) {
          const c = line.replace(/#.*$/, '').trim();
          if (c && !c.startsWith('-')) addPkg(c, prodDeps);
        }
      }
    }

    return { packageNames, prodDeps, optionalDeps, manifestFiles };
  }

  private extractCoreJsImports(coreJsFiles: Array<[string, string]>): Map<string, string[]> {
    const byPkg = new Map<string, string[]>();
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');

    const addHit = (spec: string, filePath: string) => {
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) return;
      const pkg = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0];
      if (!pkg) return;
      const list = byPkg.get(pkg) || [];
      if (!list.includes(filePath)) {
        list.push(filePath);
        byPkg.set(pkg, list);
      }
    };

    const importRe =
      /(?:import\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

    for (const [filePath, raw] of coreJsFiles) {
      const cleaned = stripComments(raw);
      let m: RegExpExecArray | null;
      importRe.lastIndex = 0;
      while ((m = importRe.exec(cleaned)) !== null) {
        const spec = m[1] || m[2] || m[3] || m[4];
        if (spec) addHit(spec.trim(), filePath);
      }
    }

    return byPkg;
  }

  private extractCorePyImports(corePyFiles: Array<[string, string]>): Map<string, string[]> {
    const byPkg = new Map<string, string[]>();
    if (corePyFiles.length === 0) return byPkg;

    const pyMap = new Map<string, string>(corePyFiles);
    const { parsedFiles } = pythonDependencyService.parsePythonFiles(pyMap);

    for (const [filePath, parsed] of parsedFiles.entries()) {
      for (const stmt of parsed.imports) {
        if (stmt.level > 0) continue; // Relative import is internal, never external framework
        const mod = stmt.module || '';
        const top = mod.split('.')[0];
        if (!top) continue;
        const list = byPkg.get(top) || [];
        if (!list.includes(filePath)) {
          list.push(filePath);
          byPkg.set(top, list);
        }
      }
    }

    return byPkg;
  }
}

export const frameworkDetectionService = new FrameworkDetectionService();
export default frameworkDetectionService;
