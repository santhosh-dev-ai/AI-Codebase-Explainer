import { API_BASE_URL } from '@/constants/config';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { githubUrl, branch } = body;

    if (!githubUrl || typeof githubUrl !== 'string') {
      return Response.json(
        { success: false, error: { message: 'Invalid GitHub URL' } },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/api/repository/analyze-github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ githubUrl, branch }),
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying analyze-github request:', error);
    return Response.json(
      {
        success: false,
        error: { message: error.message || 'Internal Server Error' },
      },
      { status: 500 }
    );
  }
}