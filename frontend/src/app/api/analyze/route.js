export async function POST(req) {
  try {
    const body = await req.json();

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "API key missing" }, { status: 500 });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "user", content: body.message }
        ]
      })
    });

    const data = await response.json();

    return Response.json({
      reply: data.choices?.[0]?.message?.content || "No response"
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}