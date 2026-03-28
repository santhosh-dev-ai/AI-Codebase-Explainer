export async function POST(req: Request) {
  const body = await req.json();

  return Response.json({
    message: "Analyze API working",
    received: body
  });
}