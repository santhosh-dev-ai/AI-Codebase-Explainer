export class PromptBuilderService {
  buildArchitectureAnalysisPrompt(
    fileTree: string,
    metadata: string,
    sampleFiles: Record<string, string>
  ): string {
    return `You are an expert software architect. Analyze this repository and return a highly detailed, accurate, evidence-based overview.

## Repository Structure:
${fileTree}

## Metadata:
${metadata}

## Sample Files for Context:
${Object.entries(sampleFiles)
  .map(([path, content]) => `### ${path}\n\`\`\`\n${content.substring(0, 700)}\n\`\`\``)
  .join('\n\n')}

Return ONLY valid JSON (no markdown, no prose outside JSON) using this exact schema:
{
  "summary": "4-8 sentences with concrete behavior and purpose",
  "executiveBullets": ["8-12 precise bullets that explain repo intent, boundaries, critical paths, and engineering tradeoffs"],
  "pattern": "primary architecture pattern",
  "projectType": "web app|api service|cli|library|data pipeline|other",
  "framework": "main framework or null",
  "techStack": ["frameworks, runtimes, key libs, infra"],
  "detectedEntryPoints": ["concrete files/functions/routes"],
  "integrationPoints": ["db, queue, cache, third-party APIs, webhooks, external services"],
  "keyModules": [
    {
      "name": "module name",
      "path": "directory or file path",
      "responsibility": "what it owns"
    }
  ],
  "dataFlow": "step-by-step flow from inputs to outputs",
  "deepDive": {
    "architectureNarrative": "how layers/components are organized and why",
    "runtimeFlow": "request/event lifecycle through concrete components",
    "dataLifecycle": "how data is validated/transformed/stored/read",
    "qualitySignals": "testing, typing, linting, code quality evidence",
    "scalabilityAndOps": "deployment/runtime constraints, scaling considerations, observability posture",
    "recommendations": "prioritized actionable improvement roadmap"
  },
  "scorecard": {
    "architecture": 0,
    "maintainability": 0,
    "complexity": 0,
    "reliability": 0,
    "security": 0
  },
  "risks": [
    {
      "title": "risk title",
      "severity": "high|medium|low",
      "detail": "why this is a risk",
      "mitigation": "recommended mitigation"
    }
  ],
  "evidence": [
    {
      "filePath": "path/to/file",
      "finding": "specific observation from file",
      "relevance": "why this supports an architectural claim"
    }
  ],
  "confidence": 0,
  "unknowns": ["items that cannot be inferred from provided files"]
}

Rules:
- Be precise and avoid speculation.
- If uncertain, include that in unknowns and reduce confidence.
- Every major architectural claim must be backed by evidence entries.
- Prefer concrete paths and identifiers over generic language.
- Scorecard values must be integers from 0 to 100 and aligned with stated evidence/risks.
- confidence must be an integer from 0 to 100.`;
  }

  buildFileExplanationPrompt(
    filePath: string,
    fileContent: string,
    language: string,
    projectContext?: string
  ): string {
    return `You are an expert code reviewer. Explain this ${language} file in detail.

## File: ${filePath}

${projectContext ? `## Project Context:\n${projectContext}\n` : ''}

## Code:
\`\`\`${language}
${fileContent}
\`\`\`

Please provide:
1. **Purpose**: What is the main responsibility of this file?
2. **Key Components**: List and explain the main functions, classes, or exports
3. **Dependencies**: What does this file depend on?
4. **Design Patterns**: Any notable design patterns used?
5. **Data Flow**: How does data move through this file?
6. **Complexity**: Rate the complexity (Low/Medium/High) and explain why

Format your response in clear markdown sections with code snippets where relevant.`;
  }

  buildBugDetectionPrompt(filePath: string, fileContent: string, language: string): string {
    return `You are a senior software engineer performing a code review. Analyze this ${language} file for potential issues.

## File: ${filePath}

## Code:
\`\`\`${language}
${fileContent}
\`\`\`

Identify:
1. **Potential Bugs**: Logic errors, edge cases not handled, null/undefined issues
2. **Security Vulnerabilities**: SQL injection, XSS, auth issues, sensitive data exposure
3. **Performance Issues**: Inefficient algorithms, memory leaks, unnecessary computations
4. **Code Smells**: Anti-patterns, poor naming, tight coupling, code duplication

For each issue found, provide:
- **Severity**: Critical/High/Medium/Low
- **Line number** (if applicable)
- **Description**: What's the problem?
- **Suggestion**: How to fix it

If no issues found, say so clearly. Format as JSON array:
\`\`\`json
[
  {
    "severity": "high",
    "type": "Potential Bug",
    "line": 42,
    "description": "...",
    "suggestion": "...",
    "codeSnippet": "..."
  }
]
\`\`\``;
  }

  buildImprovementPrompt(filePath: string, fileContent: string, language: string): string {
    return `You are a code quality consultant. Suggest improvements for this ${language} file.

## File: ${filePath}

## Code:
\`\`\`${language}
${fileContent}
\`\`\`

Suggest improvements in:
1. **Performance**: How to make it faster or more efficient
2. **Maintainability**: How to make it easier to understand and modify
3. **Best Practices**: Industry standards and conventions
4. **Code Style**: Naming, formatting, organization

For each suggestion, provide:
- **Category**: Performance/Security/Maintainability/Style
- **Priority**: High/Medium/Low
- **Description**: What to improve
- **Impact**: Why it matters

Format as JSON array:
\`\`\`json
[
  {
    "category": "performance",
    "priority": "medium",
    "line": 30,
    "description": "...",
    "suggestion": "...",
    "impact": "..."
  }
]
\`\`\``;
  }

  buildChatSystemPrompt(
    currentFile?: string,
    projectType?: string,
    relatedFiles?: string[]
  ): string {
    let prompt = `You are an AI assistant helping developers understand a codebase. You are knowledgeable, concise, and provide accurate information.`;

    if (projectType) {
      prompt += `\n\nThis is a ${projectType} project.`;
    }

    if (currentFile) {
      prompt += `\n\nThe user is currently viewing: ${currentFile}`;
    }

    if (relatedFiles && relatedFiles.length > 0) {
      prompt += `\n\nRelated files in context: ${relatedFiles.join(', ')}`;
    }

    prompt += `\n\nWhen answering:
- Be specific and reference file names and line numbers when relevant
- Provide code examples when helpful
- If you don't know something, say so
- Keep responses concise but complete
- Use markdown formatting for better readability`;

    return prompt;
  }

  buildChatPrompt(
    question: string,
    codeContext: string,
    chatHistory?: string
  ): string {
    let prompt = '';

    if (chatHistory) {
      prompt += `## Previous Conversation:\n${chatHistory}\n\n`;
    }

    if (codeContext) {
      prompt += `## Code Context:\n${codeContext}\n\n`;
    }

    prompt += `## User Question:\n${question}`;

    return prompt;
  }

  buildFlowDiagramPrompt(
    fileTree: string,
    sampleFiles: Record<string, string>,
    projectType: string
  ): string {
    return `Generate a Mermaid diagram showing the high-level data/control flow of this ${projectType} application.

## File Structure:
${fileTree}

## Sample Files:
${Object.entries(sampleFiles)
  .map(([path, content]) => `### ${path}\n${content.substring(0, 300)}...`)
  .join('\n\n')}

Create a Mermaid flowchart that shows:
1. Entry points (main files, API endpoints)
2. Key services/controllers
3. Data storage layer
4. External dependencies

Keep it high-level and focused on the main flow. Return ONLY the Mermaid code, starting with \`\`\`mermaid and ending with \`\`\`.`;
  }
}

export const promptBuilderService = new PromptBuilderService();
