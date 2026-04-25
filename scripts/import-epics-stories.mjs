import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import fs from "fs";

const owner = "HackUPC26";
const repo = "SafeHaven";
const projectId = 1; // Your project ID
const apiToken = process.env.GITHUB_TOKEN; // Set your personal access token

// Read the Markdown file
const filePath = "_bmad-output/planning-artifacts/SafeHaven-Epics-and-Stories.md";
const content = fs.readFileSync(filePath, 'utf-8');

// Parse the content (assuming simple regex or markdown parsing strategy)
const stories = parseStories(content); // Implement parseStories function

const octokit = new Octokit({ auth: apiToken });

// Create labels if they don't exist
const labels = await octokit.issues.listLabelsForRepo({ owner, repo });
const existingLabels = labels.data.map(label => label.name);

const uniqueLabels = [...new Set(stories.map(story => `epic:${story.epic}`))].filter(label => !existingLabels.includes(label));
for (const label of uniqueLabels) {
  await octokit.issues.createLabel({
    owner,
    repo,
    name: label,
    color: "f00f00", // Example color
  });
}

// Create issues for each story
for (const story of stories) {
  const issue = await octokit.issues.create({
    owner,
    repo,
    title: story.title,
    body: `Description: ${story.description}\n\n**Tasks:**\n- [ ] ${story.tasks.join('\n- [ ] ')}`,
    labels: [`epic:${story.epic}`, 'story']
  });

  // Add the issue to the project
  await graphql(`\n    mutation {\n      addProjectCard(input: { projectId: \