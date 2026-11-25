import { execFileSync } from 'child_process';
import path from 'path';
import { AmbiguousResolutionEntry, UnresolvedImportEntry } from '../../types/analysis.types';
import logger from '../../utils/logger.util';

export interface PythonImportName {
  name: string;
  asname: string | null;
}

export interface PythonImportStatement {
  kind: 'import' | 'from';
  module: string | null;
  level: number;
  names: PythonImportName[];
  line: number;
  rawStatement: string;
}

export interface ParsedPythonFileResult {
  imports: PythonImportStatement[];
  exports: string[];
  parser: 'ast' | 'fallback';
}

export interface PythonResolvedFileDependencies {
  rawImports: string[];
  resolvedInternal: string[];
  externalImports: string[];
  stdlibImports: string[];
  unresolvedImports: UnresolvedImportEntry[];
  ambiguousResolutions: AmbiguousResolutionEntry[];
  exports: string[];
  statementsExtracted: number;
}

export interface PythonRepoIndex {
  sourceRoots: string[];
  moduleToPaths: Map<string, string[]>;
  namespacePackageDirs: Set<string>;
  internalRootPackages: Set<string>;
  allPythonFiles: Set<string>;
  includedGraphFiles: Set<string>;
  manifestPackages: Set<string>;
  manifestsDetected: string[];
  runtimeStdlibModules: Set<string>;
}

const STATIC_PYTHON_STDLIB = new Set<string>([
  '__future__', '__main__', '_thread', '_dummy_thread',
  'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore', 'atexit', 'audioop',
  'base64', 'bdb', 'binascii', 'binhex', 'bisect', 'builtins', 'bz2',
  'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd', 'code', 'codecs', 'codeop', 'collections',
  'colorsys', 'compileall', 'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy',
  'copyreg', 'cProfile', 'crypt', 'csv', 'ctypes', 'curses',
  'dataclasses', 'datetime', 'dbm', 'decimal', 'difflib', 'dis', 'distutils', 'doctest',
  'email', 'encodings', 'ensurepip', 'enum', 'errno',
  'faulthandler', 'fcntl', 'filecmp', 'fileinput', 'fnmatch', 'formatter', 'fractions', 'ftplib', 'functools',
  'gc', 'genericpath', 'getopt', 'getpass', 'gettext', 'glob', 'graphlib', 'grp', 'gzip',
  'hashlib', 'heapq', 'hmac', 'html', 'http',
  'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools',
  'json', 'keyword',
  'lib2to3', 'linecache', 'locale', 'logging', 'lzma',
  'mailbox', 'mailcap', 'marshal', 'math', 'mimetypes', 'mmap', 'modulefinder', 'msilib', 'msvcrt', 'multiprocessing',
  'netrc', 'nis', 'nntplib', 'ntpath', 'numbers',
  'operator', 'optparse', 'os', 'ossaudiodev',
  'pathlib', 'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform', 'plistlib', 'poplib',
  'posix', 'posixpath', 'pprint', 'profile', 'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc',
  'queue', 'quopri',
  'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter', 'runpy',
  'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil', 'signal', 'site',
  'smtpd', 'smtplib', 'sndhdr', 'socket', 'socketserver', 'spwd', 'sqlite3', 'sre_compile',
  'sre_constants', 'sre_parse', 'ssl', 'stat', 'statistics', 'string', 'stringprep', 'struct',
  'subprocess', 'sunau', 'symtable', 'sys', 'sysconfig', 'syslog',
  'tabnanny', 'tarfile', 'telnetlib', 'tempfile', 'termios', 'test', 'textwrap', 'this',
  'threading', 'time', 'timeit', 'tkinter', 'token', 'tokenize', 'tomllib', 'trace',
  'traceback', 'tracemalloc', 'tty', 'turtle', 'turtledemo', 'types', 'typing',
  'unicodedata', 'unittest', 'urllib', 'uu', 'uuid',
  'venv', 'warnings', 'wave', 'weakref', 'webbrowser', 'winreg', 'winsound', 'wsgiref',
  'xdrlib', 'xml', 'xmlrpc',
  'zipapp', 'zipfile', 'zipimport', 'zlib', 'zoneinfo', '_thread', '_typeshed', 'ntpath', 'genericpath', 'sre_compile',
]);

// Fallback set for indisputable common external PyPI/Conda ecosystem packages when repo manifests are partial/sampled
const KNOWN_ECOSYSTEM_THIRD_PARTY = new Set<string>([
  'numpy', 'scipy', 'pandas', 'matplotlib', 'torch', 'tensorflow', 'jax', 'pytest', 'sphinx',
  'sphinx_gallery', 'docutils', 'joblib', 'threadpoolctl', 'cython', 'Cython', 'typing_extensions',
  'packaging', 'setuptools', 'wheel', 'pip', 'yaml', 'requests', 'flask', 'django', 'fastapi',
  'pydantic', 'click', 'werkzeug', 'jinja2', 'blinker', 'itsdangerous', 'markupsafe', 'dotenv',
  'asgiref', 'cryptography', 'celery', 'plotly', 'dask', 'cupy', 'numba', 'PIL', 'pillow', 'cv2',
  'bs4', 'lxml', 'sqlalchemy', 'httpx', 'aiohttp', 'uvicorn', 'starlette', 'tqdm', 'rich', 'typer',
  'mypy', 'pyarrow', 'h5py', 'sympy', 'networkx', 'seaborn', 'lightgbm', 'xgboost', 'catboost',
  'jupyterlite_sphinx', 'graphviz', 'pytest_cov', 'pluggy', 'attrs', 'attr', 'pygments', 'colorama',
]);

// Known PyPI distribution name -> top-level Python import package mapping
const PYPI_TO_IMPORT_ALIASES: Record<string, string[]> = {
  'scikit-learn': ['sklearn'],
  'scikit-image': ['skimage'],
  'pillow': ['PIL'],
  'pyyaml': ['yaml'],
  'python-dateutil': ['dateutil'],
  'beautifulsoup4': ['bs4'],
  'python-dotenv': ['dotenv'],
  'typing-extensions': ['typing_extensions'],
  'attrs': ['attr', 'attrs'],
  'opencv-python': ['cv2'],
  'opencv-python-headless': ['cv2'],
  'pycryptodome': ['Crypto'],
  'protobuf': ['google'],
  'ruamel.yaml': ['ruamel'],
  'msgpack-python': ['msgpack'],
  'pyopenssl': ['OpenSSL'],
  'mysqlclient': ['MySQLdb'],
  'psycopg2-binary': ['psycopg2'],
  'pydantic-settings': ['pydantic_settings'],
  'flask-cors': ['flask_cors'],
  'django-rest-framework': ['rest_framework'],
  'djangorestframework': ['rest_framework'],
};

const PYTHON_AST_BATCH_SCRIPT = `
import ast, json, os, sys

def get_stdlib():
    names = set(getattr(sys, 'stdlib_module_names', ()))
    names.update(sys.builtin_module_names)
    try:
        stdlib_dir = os.path.dirname(os.__file__)
        if stdlib_dir and os.path.isdir(stdlib_dir):
            for entry in os.scandir(stdlib_dir):
                name = entry.name
                if name in ('site-packages', 'dist-packages', '__pycache__'):
                    continue
                if entry.is_dir() and os.path.isfile(os.path.join(entry.path, '__init__.py')):
                    names.add(name)
                elif name.endswith('.py'):
                    names.add(name[:-3])
    except Exception:
        pass
    return sorted(names)

def format_stmt(node):
    if isinstance(node, ast.Import):
        parts = [a.name + (' as ' + a.asname if a.asname else '') for a in node.names]
        return 'import ' + ', '.join(parts)
    dots = '.' * (node.level or 0)
    mod = node.module or ''
    parts = [a.name + (' as ' + a.asname if a.asname else '') for a in node.names]
    return f'from {dots}{mod} import ' + ', '.join(parts)

def extract_all_names(tree):
    explicit = []
    for stmt in tree.body:
        targets = []
        val = None
        if isinstance(stmt, ast.Assign):
            targets = stmt.targets
            val = stmt.value
        elif isinstance(stmt, ast.AnnAssign) and stmt.target is not None:
            targets = [stmt.target]
            val = stmt.value
        if any(isinstance(t, ast.Name) and t.id == '__all__' for t in targets) and isinstance(val, (ast.List, ast.Tuple)):
            for elt in val.elts:
                if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                    explicit.append(elt.value)
    return explicit

payload = json.loads(sys.stdin.read() or '[]')
results = {}
for item in payload:
    fpath = item['path']
    content = item['content']
    try:
        tree = ast.parse(content, filename=fpath)
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append({
                        'kind': 'import',
                        'module': alias.name,
                        'level': 0,
                        'names': [{'name': alias.name, 'asname': alias.asname}],
                        'line': getattr(node, 'lineno', 1),
                        'rawStatement': format_stmt(node)
                    })
            elif isinstance(node, ast.ImportFrom):
                imports.append({
                    'kind': 'from',
                    'module': node.module,
                    'level': getattr(node, 'level', 0) or 0,
                    'names': [{'name': a.name, 'asname': a.asname} for a in node.names],
                    'line': getattr(node, 'lineno', 1),
                    'rawStatement': format_stmt(node)
                })
        exports = extract_all_names(tree)
        for stmt in tree.body:
            if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                if not stmt.name.startswith('_') and stmt.name not in exports:
                    exports.append(stmt.name)
        results[fpath] = {'ok': True, 'imports': imports, 'exports': exports[:8]}
    except SyntaxError:
        results[fpath] = {'ok': False}
    except Exception:
        results[fpath] = {'ok': False}

sys.stdout.write(json.dumps({'stdlib': get_stdlib(), 'files': results}))
`;

class PythonDependencyService {
  public isPythonFile(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.py') || lower.endsWith('.pyi');
  }

  public isExcludedPythonTestOrBuildFile(filePath: string): boolean {
    const normalized = this.normalizePath(filePath).toLowerCase();
    const base = path.basename(normalized);
    if (
      normalized.startsWith('dist/') ||
      normalized.startsWith('build/') ||
      normalized.includes('/dist/') ||
      normalized.includes('/build/') ||
      normalized.includes('/__pycache__/') ||
      normalized.includes('/.venv/') ||
      normalized.includes('/venv/')
    ) {
      return true;
    }
    // Exclude test suites cleanly while keeping legitimate library modules like testing.py or _testing.py
    if (/(^|\/)(tests?|__tests__)(\/|$)/.test(normalized)) {
      return true;
    }
    if (base.startsWith('test_') || base.endsWith('_test.py') || base === 'conftest.py') {
      return true;
    }
    return false;
  }

  public normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  /**
   * Parse all Python source files in a single fast AST subprocess batch,
   * falling back per-file to a Python-aware lexical parser if needed.
   */
  public parsePythonFiles(
    pythonFiles: Map<string, string>
  ): { parsedFiles: Map<string, ParsedPythonFileResult>; runtimeStdlib: Set<string> } {
    const parsedFiles = new Map<string, ParsedPythonFileResult>();
    const runtimeStdlib = new Set<string>(STATIC_PYTHON_STDLIB);

    if (pythonFiles.size === 0) {
      return { parsedFiles, runtimeStdlib };
    }

    const batchInput = Array.from(pythonFiles.entries()).map(([filePath, content]) => ({
      path: filePath,
      content,
    }));

    try {
      const rawOut = execFileSync('python3', ['-c', PYTHON_AST_BATCH_SCRIPT], {
        input: JSON.stringify(batchInput),
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 12000,
      });

      const parsed = JSON.parse(rawOut) as {
        stdlib?: string[];
        files?: Record<string, { ok: boolean; imports?: PythonImportStatement[]; exports?: string[] }>;
      };

      if (Array.isArray(parsed.stdlib)) {
        for (const mod of parsed.stdlib) {
          runtimeStdlib.add(mod);
        }
      }

      if (parsed.files) {
        for (const [filePath, content] of pythonFiles.entries()) {
          const entry = parsed.files[filePath];
          if (entry?.ok && Array.isArray(entry.imports)) {
            parsedFiles.set(filePath, {
              imports: entry.imports,
              exports: Array.isArray(entry.exports) ? entry.exports : [],
              parser: 'ast',
            });
          } else {
            parsedFiles.set(filePath, this.parsePythonSourceFallback(content));
          }
        }
        return { parsedFiles, runtimeStdlib };
      }
    } catch (err) {
      logger.warn('Python AST batch parser unavailable or timed out, using lexical parser fallback', {
        fileCount: pythonFiles.size,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    for (const [filePath, content] of pythonFiles.entries()) {
      parsedFiles.set(filePath, this.parsePythonSourceFallback(content));
    }

    return { parsedFiles, runtimeStdlib };
  }

  /**
   * Python-aware lexical statement parser (handles comments, strings/docstrings,
   * backslash continuations, and multiline parenthesized imports without AST runtime).
   */
  public parsePythonSourceFallback(content: string): ParsedPythonFileResult {
    const cleaned = this.stripStringsAndCommentsPreservingStructure(content);
    const statements = this.splitPythonLogicalStatements(cleaned);
    const imports: PythonImportStatement[] = [];
    const exports: string[] = [];

    for (const { text, line } of statements) {
      const trimmed = text.trim();
      if (!trimmed) continue;

      // Top-level def / class fallback export extraction
      const expMatch = trimmed.match(/^(?:async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (expMatch?.[1] && !expMatch[1].startsWith('_') && exports.length < 8) {
        if (!exports.includes(expMatch[1])) exports.push(expMatch[1]);
      }

      if (trimmed.startsWith('import ')) {
        const rest = trimmed.slice('import '.length).trim();
        const items = rest.split(',').map((s) => s.trim()).filter(Boolean);
        for (const item of items) {
          const aliasMatch = item.match(/^([A-Za-z_][A-Za-z0-9_.]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/);
          if (aliasMatch) {
            imports.push({
              kind: 'import',
              module: aliasMatch[1],
              level: 0,
              names: [{ name: aliasMatch[1], asname: aliasMatch[2] || null }],
              line,
              rawStatement: trimmed,
            });
          }
        }
      } else if (/^from\s+/.test(trimmed)) {
        const fromMatch = trimmed.match(/^from\s+(\.+[A-Za-z0-9_.]*|[A-Za-z_][A-Za-z0-9_.]*)\s+import\s+([\s\S]+)$/);
        if (fromMatch) {
          const modSpec = fromMatch[1];
          let namesSpec = fromMatch[2].trim();
          if (namesSpec.startsWith('(') && namesSpec.endsWith(')')) {
            namesSpec = namesSpec.slice(1, -1);
          }

          let level = 0;
          while (level < modSpec.length && modSpec[level] === '.') {
            level++;
          }
          const modName = modSpec.slice(level) || null;

          const names: PythonImportName[] = [];
          const parts = namesSpec.split(',').map((s) => s.trim()).filter(Boolean);
          for (const part of parts) {
            if (part === '*') {
              names.push({ name: '*', asname: null });
              continue;
            }
            const aliasMatch = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/);
            if (aliasMatch) {
              names.push({ name: aliasMatch[1], asname: aliasMatch[2] || null });
            }
          }

          if (names.length > 0) {
            imports.push({
              kind: 'from',
              module: modName,
              level,
              names,
              line,
              rawStatement: trimmed.replace(/\s+/g, ' '),
            });
          }
        }
      }
    }

    return { imports, exports, parser: 'fallback' };
  }

  private stripStringsAndCommentsPreservingStructure(source: string): string {
    const out: string[] = [];
    let i = 0;
    const len = source.length;

    while (i < len) {
      const ch = source[i];

      // Line comment outside strings
      if (ch === '#') {
        while (i < len && source[i] !== '\n') i++;
        continue;
      }

      // Check triple quotes or single/double quotes (including string prefixes like r, f, b, u)
      if (ch === "'" || ch === '"') {
        const quote = ch;
        const isTriple = source.slice(i, i + 3) === quote.repeat(3);
        const delim = isTriple ? quote.repeat(3) : quote;
        i += delim.length;
        out.push(' ');
        while (i < len) {
          if (source[i] === '\\') {
            if (source[i + 1] === '\n') out.push('\n');
            i += 2;
            continue;
          }
          if (source.slice(i, i + delim.length) === delim) {
            i += delim.length;
            break;
          }
          if (source[i] === '\n') out.push('\n');
          i++;
        }
        continue;
      }

      out.push(ch);
      i++;
    }

    return out.join('');
  }

  private splitPythonLogicalStatements(cleaned: string): Array<{ text: string; line: number }> {
    const result: Array<{ text: string; line: number }> = [];
    let current = '';
    let startLine = 1;
    let currentLine = 1;
    let parenDepth = 0;

    const lines = cleaned.split(/\r?\n/);
    for (let idx = 0; idx < lines.length; idx++) {
      const lineNum = idx + 1;
      const line = lines[idx];
      if (!current) startLine = lineNum;

      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '(' || ch === '[' || ch === '{') parenDepth++;
        else if (ch === ')' || ch === ']' || ch === '}') parenDepth = Math.max(0, parenDepth - 1);
      }

      const trimmedEnd = line.trimEnd();
      const continuesBackslash = trimmedEnd.endsWith('\\');
      const chunk = continuesBackslash ? trimmedEnd.slice(0, -1) : line;

      // Handle semicolons at top-level parenthesis depth
      current = current ? `${current} ${chunk}` : chunk;

      if (parenDepth === 0 && !continuesBackslash) {
        const segments = current.split(';');
        for (const seg of segments) {
          if (seg.trim()) {
            result.push({ text: seg.trim(), line: startLine });
          }
        }
        current = '';
      }
      currentLine = lineNum + 1;
    }

    if (current.trim()) {
      result.push({ text: current.trim(), line: startLine || currentLine });
    }
    return result;
  }

  /**
   * Build repository-wide Python module resolution index & dependency manifest catalog.
   */
  public buildRepoIndex(
    allFiles: Map<string, string>,
    includedGraphFiles: Set<string>,
    runtimeStdlibModules: Set<string>
  ): PythonRepoIndex {
    const allPythonFiles = new Set<string>();
    const manifestPackages = new Set<string>();
    const manifestsDetected: string[] = [];
    const customRoots = new Set<string>(['']);

    for (const [rawPath, content] of allFiles.entries()) {
      const filePath = this.normalizePath(rawPath);
      const lower = filePath.toLowerCase();
      const base = path.basename(lower);

      if (this.isPythonFile(filePath)) {
        allPythonFiles.add(filePath);
      }

      // Inspect manifests for package directories & declared dependencies
      if (base === 'pyproject.toml') {
        manifestsDetected.push(filePath);
        this.parsePyprojectToml(content, manifestPackages, customRoots);
      } else if (base === 'setup.cfg') {
        manifestsDetected.push(filePath);
        this.parseSetupCfg(content, manifestPackages, customRoots);
      } else if (base === 'setup.py') {
        manifestsDetected.push(filePath);
        this.parseSetupPy(content, manifestPackages, customRoots);
      } else if (
        base.endsWith('.txt') &&
        (base.startsWith('requirements') || lower.includes('/requirements/'))
      ) {
        manifestsDetected.push(filePath);
        this.parseRequirementsTxt(content, manifestPackages);
      }
    }

    // Detect conventional source roots containing packages (src/, lib/, python/)
    for (const pyPath of allPythonFiles) {
      const parts = pyPath.split('/');
      if (parts.length >= 3 && (parts[0] === 'src' || parts[0] === 'lib' || parts[0] === 'python')) {
        customRoots.add(parts[0]);
      }
    }

    const sourceRoots = Array.from(customRoots);
    const moduleToPaths = new Map<string, string[]>();
    const namespacePackageDirs = new Set<string>();
    const internalRootPackages = new Set<string>();

    const registerModule = (dotted: string, filePath: string) => {
      if (!dotted) return;
      const existing = moduleToPaths.get(dotted) || [];
      if (!existing.includes(filePath)) {
        existing.push(filePath);
        moduleToPaths.set(dotted, existing);
      }
      const top = dotted.split('.')[0];
      if (top) internalRootPackages.add(top);
    };

    for (const pyPath of allPythonFiles) {
      for (const root of sourceRoots) {
        let rel = pyPath;
        if (root) {
          const prefix = `${root}/`;
          if (!pyPath.startsWith(prefix)) continue;
          rel = pyPath.slice(prefix.length);
        }

        const ext = rel.endsWith('.pyi') ? '.pyi' : '.py';
        const noExt = rel.slice(0, -ext.length);
        const segments = noExt.split('/').filter(Boolean);
        if (segments.length === 0) continue;

        if (segments[segments.length - 1] === '__init__') {
          const pkgSegs = segments.slice(0, -1);
          if (pkgSegs.length > 0) {
            registerModule(pkgSegs.join('.'), pyPath);
          }
          registerModule(segments.join('.'), pyPath);
        } else {
          registerModule(segments.join('.'), pyPath);
          // Record parent directories as namespace packages if lacking __init__.py
          for (let depth = 1; depth < segments.length; depth++) {
            const parentDotted = segments.slice(0, depth).join('.');
            const parentDir = root ? `${root}/${segments.slice(0, depth).join('/')}` : segments.slice(0, depth).join('/');
            namespacePackageDirs.add(parentDir);
            internalRootPackages.add(segments[0]);
            if (!moduleToPaths.has(parentDotted)) {
              // Keep track via namespacePackageDirs; avoid conflating with __init__.py unless needed
            }
          }
        }
      }
    }

    return {
      sourceRoots,
      moduleToPaths,
      namespacePackageDirs,
      internalRootPackages,
      allPythonFiles,
      includedGraphFiles,
      manifestPackages,
      manifestsDetected,
      runtimeStdlibModules,
    };
  }

  private addManifestPackage(rawName: string, manifestPackages: Set<string>): void {
    const cleaned = rawName
      .trim()
      .replace(/\[[^\]]*\]/g, '')
      .replace(/[<>=!~;\s].*$/, '')
      .toLowerCase();
    if (!cleaned || !/^[a-z0-9][a-z0-9._-]*$/.test(cleaned)) return;

    manifestPackages.add(cleaned);
    manifestPackages.add(cleaned.replace(/[-.]/g, '_'));
    const top = cleaned.split('.')[0];
    if (top) manifestPackages.add(top);

    const aliases = PYPI_TO_IMPORT_ALIASES[cleaned] || PYPI_TO_IMPORT_ALIASES[cleaned.replace(/_/g, '-')];
    if (aliases) {
      for (const a of aliases) {
        manifestPackages.add(a);
        manifestPackages.add(a.toLowerCase());
      }
    }
  }

  private parseRequirementsTxt(content: string, out: Set<string>): void {
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const noComment = rawLine.replace(/#.*$/, '').trim();
      if (!noComment || noComment.startsWith('-')) continue;
      this.addManifestPackage(noComment, out);
    }
  }

  private parsePyprojectToml(content: string, out: Set<string>, roots: Set<string>): void {
    // Capture quoted dependencies inside dependencies / requires arrays
    const arrayBlockRegex = /(?:dependencies|requires)\s*=\s*\[([\s\S]*?)\]/gi;
    let m: RegExpExecArray | null;
    while ((m = arrayBlockRegex.exec(content)) !== null) {
      const inner = m[1];
      const strRegex = /["']([^"']+)["']/g;
      let sm: RegExpExecArray | null;
      while ((sm = strRegex.exec(inner)) !== null) {
        this.addManifestPackage(sm[1], out);
      }
    }

    // Capture TOML sections like [project.optional-dependencies], [dependency-groups], [tool.poetry.group.*.dependencies]
    const sectionRegex = /\[(?:project\.optional-dependencies|dependency-groups|tool\.poetry\.(?:dev-dependencies|group\.[^.\]]+\.dependencies))\]([\s\S]*?)(?=\n\[|$)/gi;
    while ((m = sectionRegex.exec(content)) !== null) {
      const sectionBody = m[1];
      const arrRegex = /[A-Za-z0-9._-]+\s*=\s*\[([\s\S]*?)\]/g;
      let am: RegExpExecArray | null;
      while ((am = arrRegex.exec(sectionBody)) !== null) {
        const strRegex = /["']([^"']+)["']/g;
        let sm: RegExpExecArray | null;
        while ((sm = strRegex.exec(am[1])) !== null) {
          this.addManifestPackage(sm[1], out);
        }
      }
    }

    // Poetry style: pkg = "^1.0"
    const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/i);
    if (poetryMatch?.[1]) {
      for (const line of poetryMatch[1].split(/\r?\n/)) {
        const kv = line.match(/^\s*([A-Za-z0-9._-]+)\s*=/);
        if (kv?.[1] && kv[1].toLowerCase() !== 'python') {
          this.addManifestPackage(kv[1], out);
        }
      }
    }

    // Optional package discovery roots: where = ["src"] or package-dir = {"" = "src"}
    const whereMatch = content.match(/where\s*=\s*\[([^\]]+)\]/i);
    if (whereMatch?.[1]) {
      const strRegex = /["']([^"']+)["']/g;
      let sm: RegExpExecArray | null;
      while ((sm = strRegex.exec(whereMatch[1])) !== null) {
        const dir = sm[1].replace(/^\.\//, '').replace(/\/$/, '');
        if (dir && dir !== '.') roots.add(dir);
      }
    }
  }

  private parseSetupCfg(content: string, out: Set<string>, roots: Set<string>): void {
    const reqBlock = content.match(/install_requires\s*=([\s\S]*?)(?:\n[A-Za-z_]+\s*=|\n\[|$)/i);
    if (reqBlock?.[1]) {
      for (const line of reqBlock[1].split(/\r?\n/)) {
        const cleaned = line.replace(/#.*$/, '').trim();
        if (cleaned) this.addManifestPackage(cleaned, out);
      }
    }
    const pkgDir = content.match(/package_dir\s*=\s*(?:=\s*)?([^\n]+)/i);
    if (pkgDir?.[1] && pkgDir[1].includes('src')) {
      roots.add('src');
    }
  }

  private parseSetupPy(content: string, out: Set<string>, roots: Set<string>): void {
    const reqMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/i);
    if (reqMatch?.[1]) {
      const strRegex = /["']([^"']+)["']/g;
      let sm: RegExpExecArray | null;
      while ((sm = strRegex.exec(reqMatch[1])) !== null) {
        this.addManifestPackage(sm[1], out);
      }
    }
    if (/package_dir\s*=\s*\{[^}]*['"]src['"]/i.test(content)) {
      roots.add('src');
    }
  }

  /**
   * Resolve all extracted Python imports for a source file against the indexed repo.
   */
  public resolveFileDependencies(
    sourceFile: string,
    parsed: ParsedPythonFileResult,
    index: PythonRepoIndex
  ): PythonResolvedFileDependencies {
    const rawImports: string[] = [];
    const resolvedInternal: string[] = [];
    const externalImports: string[] = [];
    const stdlibImports: string[] = [];
    const unresolvedImports: UnresolvedImportEntry[] = [];
    const ambiguousResolutions: AmbiguousResolutionEntry[] = [];

    const addUnique = (arr: string[], val: string) => {
      if (val && !arr.includes(val)) arr.push(val);
    };

    const pickBestCandidate = (
      candidates: string[],
      specifier: string
    ): string | null => {
      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];

      // Prefer .py over .pyi, same source root as sourceFile, then 'src/'
      const sourceRoot = index.sourceRoots.find((r) => r && sourceFile.startsWith(`${r}/`)) || '';
      const ranked = [...candidates].sort((a, b) => {
        const aPy = a.endsWith('.py') ? 0 : 1;
        const bPy = b.endsWith('.py') ? 0 : 1;
        if (aPy !== bPy) return aPy - bPy;

        const aSameRoot = sourceRoot && a.startsWith(`${sourceRoot}/`) ? 0 : 1;
        const bSameRoot = sourceRoot && b.startsWith(`${sourceRoot}/`) ? 0 : 1;
        if (aSameRoot !== bSameRoot) return aSameRoot - bSameRoot;

        const aInGraph = index.includedGraphFiles.has(a) ? 0 : 1;
        const bInGraph = index.includedGraphFiles.has(b) ? 0 : 1;
        return aInGraph - bInGraph;
      });

      const nonStubDistinct = ranked.filter((c) => c.endsWith('.py'));
      if (nonStubDistinct.length > 1) {
        ambiguousResolutions.push({
          sourceFile,
          specifier,
          candidates: nonStubDistinct,
          selected: ranked[0],
        });
      }
      return ranked[0];
    };

    const resolveRelativeDotted = (
      baseDirParts: string[],
      dottedPath: string
    ): { resolved: string | null; isNamespaceDir: boolean } => {
      const targetSegs = dottedPath ? dottedPath.split('.').filter(Boolean) : [];
      const fullSegs = [...baseDirParts, ...targetSegs];
      const joined = fullSegs.join('/');

      const directCandidates = [
        `${joined}.py`,
        `${joined}.pyi`,
        joined ? `${joined}/__init__.py` : '__init__.py',
        joined ? `${joined}/__init__.pyi` : '__init__.pyi',
      ];
      const matches = directCandidates.filter((c) => index.allPythonFiles.has(c));
      if (matches.length > 0) {
        return { resolved: matches[0], isNamespaceDir: false };
      }

      if (index.namespacePackageDirs.has(joined)) {
        return { resolved: null, isNamespaceDir: true };
      }
      return { resolved: null, isNamespaceDir: false };
    };

    const resolveAbsoluteDotted = (
      dotted: string
    ): { resolved: string | null; isNamespaceDir: boolean } => {
      const candidates = index.moduleToPaths.get(dotted) || [];
      if (candidates.length > 0) {
        return { resolved: pickBestCandidate(candidates, dotted), isNamespaceDir: false };
      }
      const dirSlashed = dotted.replace(/\./g, '/');
      for (const root of index.sourceRoots) {
        const dirPath = root ? `${root}/${dirSlashed}` : dirSlashed;
        if (index.namespacePackageDirs.has(dirPath)) {
          return { resolved: null, isNamespaceDir: true };
        }
      }
      return { resolved: null, isNamespaceDir: false };
    };

    const classifyNonInternal = (topPkg: string): 'stdlib' | 'thirdParty' | 'unresolved' => {
      if (!topPkg) return 'unresolved';
      if (index.runtimeStdlibModules.has(topPkg) || STATIC_PYTHON_STDLIB.has(topPkg)) {
        return 'stdlib';
      }
      const lowerTop = topPkg.toLowerCase();
      if (
        index.manifestPackages.has(topPkg) ||
        index.manifestPackages.has(lowerTop) ||
        index.manifestPackages.has(lowerTop.replace(/_/g, '-'))
      ) {
        return 'thirdParty';
      }
      if (KNOWN_ECOSYSTEM_THIRD_PARTY.has(topPkg) || KNOWN_ECOSYSTEM_THIRD_PARTY.has(lowerTop)) {
        return 'thirdParty';
      }
      return 'unresolved';
    };

    const recordInternalMatch = (targetFile: string, specifier: string, line: number) => {
      if (targetFile === sourceFile) {
        // Explicit self-import handling: ignore self-loop edges cleanly without false error
        return;
      }
      if (index.includedGraphFiles.has(targetFile)) {
        addUnique(resolvedInternal, targetFile);
      } else {
        // Target exists in repo (e.g. a test module) but excluded from architecture graph nodes
        unresolvedImports.push({
          sourceFile,
          specifier,
          reason: 'non-source-target',
          line,
        });
      }
    };

    for (const stmt of parsed.imports) {
      addUnique(rawImports, stmt.rawStatement);

      if (stmt.kind === 'import') {
        const mod = stmt.module || '';
        const { resolved, isNamespaceDir } = resolveAbsoluteDotted(mod);
        if (resolved) {
          recordInternalMatch(resolved, mod, stmt.line);
          continue;
        }
        if (isNamespaceDir) {
          // Pure namespace package import with no __init__.py has no single target file
          continue;
        }
        const topPkg = mod.split('.')[0];
        if (index.internalRootPackages.has(topPkg)) {
          unresolvedImports.push({ sourceFile, specifier: mod, reason: 'missing-module', line: stmt.line });
          continue;
        }
        const extClass = classifyNonInternal(topPkg);
        if (extClass === 'stdlib') addUnique(stdlibImports, topPkg);
        else if (extClass === 'thirdParty') addUnique(externalImports, topPkg);
        else unresolvedImports.push({ sourceFile, specifier: mod, reason: 'missing-module', line: stmt.line });
        continue;
      }

      // stmt.kind === 'from'
      if (stmt.level > 0) {
        const currentDir = path.dirname(sourceFile);
        const dirParts = currentDir === '.' ? [] : currentDir.split('/').filter(Boolean);
        const pops = stmt.level - 1;
        const activeRoot = index.sourceRoots.find((r) => r && sourceFile.startsWith(`${r}/`)) || '';
        const rootDepth = activeRoot ? activeRoot.split('/').filter(Boolean).length : 0;
        const remainingDepth = dirParts.length - pops;
        if (pops >= dirParts.length || (activeRoot && remainingDepth <= rootDepth)) {
          unresolvedImports.push({
            sourceFile,
            specifier: stmt.rawStatement,
            reason: 'beyond-root',
            line: stmt.line,
          });
          continue;
        }

        const baseDirParts = dirParts.slice(0, dirParts.length - pops);
        if (stmt.module) {
          // First check if any imported name is itself a submodule (e.g. from .sub import child_mod)
          let matchedAnySubmodule = false;
          for (const imp of stmt.names) {
            if (imp.name === '*') continue;
            const subRes = resolveRelativeDotted(baseDirParts, `${stmt.module}.${imp.name}`);
            if (subRes.resolved) {
              recordInternalMatch(subRes.resolved, `${'.'.repeat(stmt.level)}${stmt.module}.${imp.name}`, stmt.line);
              matchedAnySubmodule = true;
            }
          }

          if (!matchedAnySubmodule) {
            const baseRes = resolveRelativeDotted(baseDirParts, stmt.module);
            if (baseRes.resolved) {
              recordInternalMatch(baseRes.resolved, `${'.'.repeat(stmt.level)}${stmt.module}`, stmt.line);
            } else if (!baseRes.isNamespaceDir) {
              unresolvedImports.push({
                sourceFile,
                specifier: `${'.'.repeat(stmt.level)}${stmt.module}`,
                reason: 'missing-module',
                line: stmt.line,
              });
            }
          }
        } else {
          // `from . import a, b` -> resolve sibling submodule/subpackage, or parent package `__init__.py`
          const parentPkgInit = resolveRelativeDotted(baseDirParts, '');
          for (const imp of stmt.names) {
            if (imp.name === '*') continue;
            const relRes = resolveRelativeDotted(baseDirParts, imp.name);
            if (relRes.resolved) {
              recordInternalMatch(relRes.resolved, `${'.'.repeat(stmt.level)}${imp.name}`, stmt.line);
            } else if (parentPkgInit.resolved) {
              recordInternalMatch(parentPkgInit.resolved, `${'.'.repeat(stmt.level)}${imp.name}`, stmt.line);
            } else if (!relRes.isNamespaceDir && !parentPkgInit.isNamespaceDir) {
              unresolvedImports.push({
                sourceFile,
                specifier: `${'.'.repeat(stmt.level)}${imp.name}`,
                reason: 'missing-module',
                line: stmt.line,
              });
            }
          }
        }
        continue;
      }

      // Absolute `from pkg[.sub] import name1, name2`
      const mod = stmt.module || '';
      let anySubmoduleResolved = false;
      const unresolvedChildOrSymbolNames: string[] = [];

      for (const imp of stmt.names) {
        if (imp.name === '*') continue;
        const combined = `${mod}.${imp.name}`;
        const subRes = resolveAbsoluteDotted(combined);
        if (subRes.resolved) {
          recordInternalMatch(subRes.resolved, combined, stmt.line);
          anySubmoduleResolved = true;
        } else {
          unresolvedChildOrSymbolNames.push(imp.name);
        }
      }

      if (!anySubmoduleResolved || unresolvedChildOrSymbolNames.length > 0) {
        const modRes = resolveAbsoluteDotted(mod);
        if (modRes.resolved) {
          recordInternalMatch(modRes.resolved, mod, stmt.line);
        } else if (!anySubmoduleResolved && !modRes.isNamespaceDir) {
          const topPkg = mod.split('.')[0];
          if (index.internalRootPackages.has(topPkg)) {
            unresolvedImports.push({ sourceFile, specifier: mod, reason: 'missing-module', line: stmt.line });
          } else {
            const extClass = classifyNonInternal(topPkg);
            if (extClass === 'stdlib') addUnique(stdlibImports, topPkg);
            else if (extClass === 'thirdParty') addUnique(externalImports, topPkg);
            else unresolvedImports.push({ sourceFile, specifier: mod, reason: 'missing-module', line: stmt.line });
          }
        }
      }
    }

    return {
      rawImports,
      resolvedInternal,
      externalImports,
      stdlibImports,
      unresolvedImports,
      ambiguousResolutions,
      exports: parsed.exports,
      statementsExtracted: parsed.imports.length,
    };
  }

  /**
   * Detect cycles in internal dependency graph edges using Tarjan's strongly connected components.
   */
  public detectCircularDependencies(adjacency: Map<string, string[]>): string[][] {
    let index = 0;
    const indices = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];

    const strongConnect = (v: string) => {
      indices.set(v, index);
      lowlink.set(v, index);
      index++;
      stack.push(v);
      onStack.add(v);

      const neighbors = adjacency.get(v) || [];
      for (const w of neighbors) {
        if (!indices.has(w)) {
          strongConnect(w);
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
        }
      }

      if (lowlink.get(v) === indices.get(v)) {
        const scc: string[] = [];
        while (true) {
          const w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
          if (w === v) break;
        }
        if (scc.length > 1) {
          cycles.push(scc.reverse());
        }
      }
    };

    for (const node of adjacency.keys()) {
      if (!indices.has(node)) {
        strongConnect(node);
      }
    }

    return cycles;
  }
}

export const pythonDependencyService = new PythonDependencyService();
export default pythonDependencyService;
