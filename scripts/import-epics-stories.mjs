import fs from 'fs';

const OWNER = 'HackUPC26';
const REPO  = 'SafeHaven';
const TOKEN = process.env.GH_TOKEN;

if (!TOKEN) {
  console.error('ERROR: GH_TOKEN environment variable is not set.');
  process.exit(1);
}

const API = 'https://api.github.com';
const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
};

// ── Parser ────────────────────────────────────────────────────────────────────

function parseEpicsAndStories(markdown) {
  const lines = markdown.split('\n');
  const stories = [];
  let currentEpic = null;
  let currentStory = null;
  let bodyLines = [];

  const flushStory = () => {
    if (currentStory) {
      currentStory.body = bodyLines.join('\n').trim();
      stories.push(currentStory);
      currentStory = null;
      bodyLines = [];
    }
  };

  for (const line of lines) {
    // ## E1 — Title
    const epicMatch = line.match(/^## (E\d+) — (.+)/);
    if (epicMatch) {
      flushStory();
      currentEpic = { id: epicMatch[1], title: epicMatch[2].trim() };
      continue;
    }

    // ### E1.1 — Title
    const storyMatch = line.match(/^### (E\d+\.\d+) — (.+)/);
    if (storyMatch && currentEpic) {
      flushStory();
      currentStory = {
        id:        storyMatch[1],
        title:     `${storyMatch[1]} — ${storyMatch[2].trim()}`,
        epic:      currentEpic.id,
        epicTitle: currentEpic.title,
      };
      continue;
    }

    if (currentStory) bodyLines.push(line);
  }

  flushStory();
  return stories;
}

// ── GitHub API helpers ────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function ensureLabel(name, color, description = '') {
  const { status, data } = await apiPost(
    `/repos/${OWNER}/${REPO}/labels`,
    { name, color, description }
  );
  if (status === 201) {
    console.log(`  ✓ Created label: ${name}`);
  } else if (status === 422) {
    console.log(`  · Label already exists: ${name}`);
  } else {
    console.error(`  ✗ Label "${name}" failed: ${status} ${data.message}`);
  }
}

async function createIssue(title, body, labels) {
  const { status, data } = await apiPost(
    `/repos/${OWNER}/${REPO}/issues`,
    { title, body, labels }
  );
  if (status === 201) {
    console.log(`  ✓ #${data.number}: ${title}`);
  } else {
    console.error(`  ✗ Issue "${title}" failed: ${status} ${data.message}`);
  }
  // Avoid secondary rate limit
  await new Promise(r => setTimeout(r, 600));
}

// ── Epic label colours ────────────────────────────────────────────────────────

const EPIC_COLORS = {
  E1: '0075ca', // blue      — Foundation
  E2: '00b16a', // green     — RN UI
  E3: 'e4e669', // yellow    — Audio/Video
  E4: 'f9d0c4', // pink      — GPS
  E5: 'd93f0b', // red       — ML
  E6: 'bfd4f2', // light blue — Triggers
  E7: 'c2e0c6', // mint      — Browser PWA
  E8: 'fef2c0', // cream     — Evidence
  E9: 'e99695', // rose      — Onboarding
};

// ── Main ──────────────────────────────────────────────────────────────────────

const mdPath = '_bmad-output/planning-artifacts/SafeHaven-Epics-and-Stories.md';

if (!fs.existsSync(mdPath)) {
  console.error(`ERROR: File not found: ${mdPath}`);
  process.exit(1);
}

const content = fs.readFileSync(mdPath, 'utf-8');
const stories = parseEpicsAndStories(content);

if (stories.length === 0) {
  console.error('ERROR: No stories parsed from markdown. Check the file format.');
  process.exit(1);
}

console.log(`Parsed ${stories.length} stories across epics: ${[...new Set(stories.map(s => s.epic))].join(', ')}\n`);

// Create labels
console.log('Creating labels...');
const epics = [...new Set(stories.map(s => s.epic))];
for (const epic of epics) {
  const epicStory = stories.find(s => s.epic === epic);
  await ensureLabel(epic, EPIC_COLORS[epic] ?? 'ededed', epicStory?.epicTitle ?? '');
}
await ensureLabel('story', 'bfd4f2', 'Implementation story');

// Create issues
console.log('\nCreating issues...');
for (const story of stories) {
  const body = [
    `**Epic:** ${story.epic} — ${story.epicTitle}`,
    '',
    story.body,
  ].join('\n');

  await createIssue(story.title, body, [story.epic, 'story']);
}

console.log('\nDone.');
