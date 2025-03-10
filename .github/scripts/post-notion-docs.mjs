import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';
import fetch from 'node-fetch';

const NOTION_VERSION = '2022-06-28';

/**
 * Fetch all child blocks of a given Notion block (or page).
 * Handles pagination for up to 100 children at a time.
 * @param {string} blockId
 * @param {string} notionToken
 * @returns {Promise<any[]>} array of blocks
 */
async function getBlockChildren (blockId, notionToken)
{
    const children = [];
    let hasMore = true;
    let startCursor = null;

    while (hasMore)
    {
        const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
        if (startCursor)
        {
            url.searchParams.set('start_cursor', startCursor);
        }

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': NOTION_VERSION,
            },
        });

        if (!res.ok)
        {
            const text = await res.text();
            throw new Error(`Failed to retrieve block children. Status: ${res.status}. Body: ${text}`);
        }

        const data = await res.json();
        children.push(...data.results);

        hasMore = data.has_more;
        startCursor = data.next_cursor;
    }

    return children;
}

/**
 * A naive "similarity" check between two strings.
 * Here we simply check if str1 includes str2 or vice versa.
 * Adjust this logic if you need more robust matching.
 */
function isSimilar (str1, str2)
{
    if (!str1 || !str2) return false;
    return str1.includes(str2) || str2.includes(str1);
}

/**
 * Splits a given text into chunks with a maximum length.
 * @param {string} text - The text to split.
 * @param {number} maxLength - Maximum allowed length per chunk (default 2000).
 * @returns {string[]} Array of text chunks.
 */
function splitTextIntoChunks (text, maxLength = 2000)
{
    const chunks = [];
    let start = 0;
    while (start < text.length)
    {
        chunks.push(text.substring(start, start + maxLength));
        start += maxLength;
    }
    return chunks;
}

async function run ()
{
    try
    {
        // Validate required environment variables
        const openaiApiKey = process.env.OPENAI_API_KEY;
        const githubToken = process.env.GITHUB_TOKEN;
        const notionToken = process.env.NOTION_TOKEN;
        const notionPageId = process.env.NOTION_PAGE_ID;

        if (!openaiApiKey)
        {
            throw new Error('OPENAI_API_KEY environment variable is not set.');
        }
        if (!githubToken)
        {
            throw new Error('GITHUB_TOKEN environment variable is not set.');
        }
        if (!notionToken)
        {
            throw new Error('NOTION_TOKEN environment variable is not set.');
        }
        if (!notionPageId)
        {
            throw new Error('NOTION_PAGE_ID environment variable is not set.');
        }

        const octokit = github.getOctokit(githubToken);
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const { owner, repo, number: pull_number } = github.context.issue;
        if (!pull_number)
        {
            throw new Error('This action was not triggered by a pull_request event.');
        }

        // Get the pull request diff from GitHub
        const { data: prDiff } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number,
            mediaType: { format: 'diff' },
        });

        // Generate a high-level documentation prompt for Notion (non-technical summary)
        const promptHighLevel = `
      The following is a Git diff of changes in this Pull Request compared to the "main" branch.
      Generate a high-level summary of the changes that is suitable for project managers, QA, and new hires.
      Focus on what was accomplished and why, avoiding overly technical details.
      Diff:
      ${prDiff}
    `;

        console.log('Calling OpenAI API to generate high-level documentation for Notion...');
        const responseHighLevel = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful documentation generator that creates high-level, non-technical summaries of changes.',
                },
                {
                    role: 'user',
                    content: promptHighLevel,
                },
            ],
            max_tokens: 800,
        });

        const highLevelDocs = responseHighLevel.choices?.[0]?.message?.content?.trim() || '';
        if (!highLevelDocs)
        {
            throw new Error('No high-level documentation was generated by the OpenAI API.');
        }

        const currentDate = new Date().toLocaleString(); // e.g. "2/23/2025, 3:45:18 PM"
        const newTextWithDate = `Last updated on ${currentDate}:\n${highLevelDocs}`;

        // Split the newTextWithDate into chunks that do not exceed 2000 characters
        const chunks = splitTextIntoChunks(newTextWithDate);

        // Fetch all existing blocks on the Notion page
        console.log('Fetching existing Notion blocks to check for duplicate documentation...');
        const existingBlocks = await getBlockChildren(notionPageId, notionToken);

        // Look for any paragraph blocks that contain similar documentation text
        const similarParagraphs = existingBlocks.filter(
            (block) =>
                block.type === 'paragraph' &&
                block.paragraph?.rich_text?.[0]?.plain_text &&
                isSimilar(block.paragraph.rich_text[0].plain_text, highLevelDocs)
        );

        // Archive each similar paragraph block
        for (const block of similarParagraphs)
        {
            const patchUrl = `https://api.notion.com/v1/blocks/${block.id}`;
            const patchBody = { archived: true };

            const patchRes = await fetch(patchUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${notionToken}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': NOTION_VERSION,
                },
                body: JSON.stringify(patchBody),
            });

            if (!patchRes.ok)
            {
                const errorBody = await patchRes.text();
                throw new Error(`Failed to archive paragraph block with ID ${block.id}. Status: ${patchRes.status}. Body: ${errorBody}`);
            }

            console.log(`Archived similar paragraph block with ID: ${block.id}`);
        }

        // Create paragraph blocks from each text chunk
        const childrenBlocks = chunks.map(chunk => ({
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [
                    {
                        type: 'text',
                        text: { content: chunk },
                    },
                ],
            },
        }));

        // Append new paragraph blocks to the Notion page
        console.log('Appending new paragraph block(s) to the Notion page...');
        const addChildrenUrl = `https://api.notion.com/v1/blocks/${notionPageId}/children`;
        const addChildrenBody = { children: childrenBlocks };

        const addChildrenRes = await fetch(addChildrenUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': NOTION_VERSION,
            },
            body: JSON.stringify(addChildrenBody),
        });

        if (!addChildrenRes.ok)
        {
            const errorBody = await addChildrenRes.text();
            throw new Error(`Failed to append new paragraph block to Notion page. Status: ${addChildrenRes.status}. Body: ${errorBody}`);
        }

        console.log('Successfully updated Notion page documentation.');
    } catch (error)
    {
        console.error('Error generating or posting Notion documentation:', error);
        core.setFailed(error.message);
    }
}

run();
