const { execSync } = require('child_process');
const core = require('@actions/core');
const github = require('@actions/github');
const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');

async function main ()
{
  try
  {
    // 1. Retrieve environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey)
    {
      throw new Error('OPENAI_API_KEY is not defined');
    }
    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber)
    {
      throw new Error('No pull request found in context');
    }

    // 2. Get the diff for the PR using git
    // Make sure the checkout action checked out all commits:
    // Fetch the latest main branch from origin
    execSync('git fetch origin main', { encoding: 'utf-8' });

    // Now get the diff between origin/main and the current HEAD
    const diff = execSync('git diff origin/main...HEAD', { encoding: 'utf-8' });
    if (!diff)
    {
      throw new Error('No diff available for this PR.');
    }

    // 3. Prepare the prompt for OpenAI
    const prompt = `
Generate comprehensive documentation based on the following git diff.
Please include a summary of changes, affected modules, and any necessary setup or configuration changes.
Git Diff:
${diff}
    `;

    // 4. Set up OpenAI client
    const configuration = new Configuration({ apiKey: openaiApiKey });
    const openai = new OpenAIApi(configuration);

    // 5. Call OpenAI API with the prompt
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: prompt,
      max_tokens: 500, // adjust token limit as needed
      temperature: 0.5,
    });

    const documentation = response.data.choices[0].text.trim();

    // 6. Write the generated documentation to a file
    fs.writeFileSync('GENERATED_DOCUMENTATION.md', documentation);
    console.log('Documentation generated and saved to GENERATED_DOCUMENTATION.md');

    // Optionally, post the documentation as a comment on the PR
    const token = process.env.GITHUB_TOKEN; // GITHUB_TOKEN is automatically provided
    const octokit = github.getOctokit(token);
    await octokit.rest.issues.createComment({
      ...github.context.repo,
      issue_number: prNumber,
      body: `### Auto-generated Documentation\n\n${documentation}`
    });
    console.log('Documentation posted as a comment on the PR.');

  } catch (error)
  {
    core.setFailed(error.message);
  }
}

main();
