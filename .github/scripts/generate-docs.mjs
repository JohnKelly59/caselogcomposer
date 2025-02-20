// Rename this file to generate-docs.mjs or add "type": "module" to package.json

import OpenAI from 'openai';
import * as core from '@actions/core';
import * as github from '@actions/github';

async function generateDocumentation ()
{
  try
  {
    // Retrieve the API key from environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey)
    {
      throw new Error('OPENAI_API_KEY environment variable is not set.');
    }

    console.log('Waiting before making API request...');
    await sleep(5000);

    // Create a new OpenAI instance
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Example: Prepare a prompt (modify this to use actual PR diff data)
    const prompt = 'Generate documentation based on the following changes: ...';

    // Make a call to the OpenAI API with the gpt-4o model
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a documentation generator.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
    });

    // Extract and log the generated documentation
    const docs = response.choices[0].message.content.trim();
    console.log('Generated Documentation:');
    console.log(docs);
  } catch (error)
  {
    console.error('Error generating documentation:', error);
    process.exit(1);
  }
}

generateDocumentation();
