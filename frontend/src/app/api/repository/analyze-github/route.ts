import { githubService } from '@/services/repository/github.service';
import { fileTreeService } from '@/services/repository/file-tree.service';
import { sessionService } from '@/services/storage/session.service';
import { isValidGitHubUrl } from '@/services/repository/validation.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { githubUrl, branch } = body;

    // ✅ Validation
    if (!isValidGitHubUrl(githubUrl)) {
      return Response.json(
        { success: false, error: 'Invalid GitHub URL' },
        { status: 400 }
      );
    }

    console.log('Analyzing GitHub repository', { githubUrl, branch });

    // ✅ Fetch repository
    const files = await githubService.fetchRepository(githubUrl);

    // ✅ Filter large repos
    const filteredFiles = fileTreeService.filterLargeRepository(files);

    // ✅ Generate tree + metadata
    const fileTree = fileTreeService.generateFileTree(filteredFiles);
    const metadata = fileTreeService.generateMetadata(filteredFiles);

    // ⚠️ SESSION WARNING (see below)
    const sessionId = sessionService.createSession({
      fileTree,
      metadata,
      files: filteredFiles,
      source: 'github',
      sourceUrl: githubUrl,
    });

    return Response.json({
      success: true,
      data: {
        sessionId,
        fileTree,
        metadata,
      },
    });

  } catch (error: any) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error: error.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}