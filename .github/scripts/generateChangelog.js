import { execSync } from "child_process";
import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Provided by GitHub Secret at runtime
});

async function generateChangelog() {
  try {
    // Get Git diff between the last commit (HEAD) and the previous one (HEAD^)
    const diff = execSync("git diff HEAD^ HEAD").toString().trim();

    if (!diff) {
      console.log("No changes detected.");
      return;
    }

    console.log("Generating changelog for the following changes:\n", diff);

    // Send the diff to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4", // Replace with "gpt-3.5-turbo" if desired
      messages: [
        {
          role: "system",
          content: "You are a helpful documentation assistant.",
        },
        {
          role: "user",
          content: `Generate a concise changelog entry for the following Git diff:\n${diff}`,
        },
      ],
    });

    const generatedText = response.choices[0].message.content.trim();
    console.log("Generated Changelog Entry:\n", generatedText);

    // Append the generated text to CHANGELOG.md
    fs.appendFileSync("CHANGELOG.md", `\n## Changes in this commit\n${generatedText}\n`);

    console.log("Changelog updated successfully.");
  } catch (error) {
    console.error("Error generating changelog:", error);
    process.exit(1);
  }
}

generateChangelog();
