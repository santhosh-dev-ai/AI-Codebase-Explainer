import dotenv from "dotenv";
dotenv.config();

import readline from "readline";
import { analyzeRepo, chatWithRepo, detectBugs } from "./aiService.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🤖 Autonomous AI Agent Started!\n");

rl.question("Enter GitHub Repo URL: ", (repoUrl) => {

  function ask() {
    rl.question("\n💬 Ask something (analyze / bugs / question): ", async (input) => {
      try {
        let result;

        if (input.toLowerCase() === "analyze") {
          result = await analyzeRepo(repoUrl);
        } 
        else if (input.toLowerCase() === "bugs") {
          result = await detectBugs(repoUrl);
        } 
        else {
          result = await chatWithRepo(repoUrl, input);
        }

        console.log("\n🧠 AI Response:\n");
        console.log(result);

        ask();
      } catch (err) {
        console.error("❌ Error:", err.message);
        rl.close();
      }
    });
  }

  ask();
});