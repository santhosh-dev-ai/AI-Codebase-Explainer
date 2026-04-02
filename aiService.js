import fetch from "node-fetch";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(prompt) {
  const response = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are an expert AI software engineer who explains codebases clearly and intelligently."
        },
        {
          role: "user",
          content: prompt
        }
      ],
    }),
  });

  const data = await response.json();

  if (!data || !data.choices || !data.choices[0]) {
    console.error("❌ Groq API Error Response:\n", data);
    throw new Error("Invalid response from Groq API");
  }

  return data.choices[0].message.content;
}

// 🔍 Repo Analysis
export async function analyzeRepo(repoUrl) {
  const prompt = `
Analyze this GitHub repository: ${repoUrl}

Give:
- Project overview
- Folder structure explanation
- Key components
- Workflow
- Improvements
`;

  return await callGroq(prompt);
}

// 💬 Chat
export async function chatWithRepo(repoUrl, question) {
  const prompt = `
Repository: ${repoUrl}

User question: ${question}

Answer clearly based on repository context.
`;

  return await callGroq(prompt);
}

// 🐞 Bug Detection
export async function detectBugs(repoUrl) {
  const prompt = `
Analyze this repository for potential bugs or bad practices: ${repoUrl}

List:
- Possible issues
- Code smells
- Improvements
`;

  return await callGroq(prompt);
}