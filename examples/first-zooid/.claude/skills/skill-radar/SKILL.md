# /skill-radar — Zooid Skill Radar

Analyzes a SKILL.md commit from GitHub and publishes a summary to the `skill-radar` channel. Use this to track new and updated Claude Code skills across the ecosystem.

## Usage

```
/skill-radar <github-commit-url>
```

The URL should point to a commit that adds or modifies a SKILL.md file. Any GitHub commit URL format works:

```
/skill-radar https://github.com/zooid-ai/zooid/commit/abc123
/skill-radar https://github.com/someorg/somerepo/commit/def456
```

## Process

### Step 1: Parse the commit URL

Extract the owner, repo, and commit SHA from the URL. The expected format is:

```
https://github.com/{owner}/{repo}/commit/{sha}
```

If the URL doesn't match this pattern, ask the user for a valid GitHub commit URL.

### Step 2: Fetch the commit details

Use the `gh` CLI to get the commit diff and metadata:

```bash
gh api repos/{owner}/{repo}/commits/{sha}
```

From the response, extract:

- **Commit message** — what the author said about the change
- **Author** — who made the commit
- **Date** — when it was committed
- **Files changed** — look for any file named `SKILL.md` (at any path depth)

If no SKILL.md file is found in the commit, tell the user: "This commit doesn't include a SKILL.md file. Try a different commit URL."

### Step 3: Determine if new or updated

Check the `status` field of the SKILL.md file in the commit:

- `added` — this is a **new skill**
- `modified` — this is an **update to an existing skill**
- `renamed` — this is a **renamed/moved skill**

If the status is `added`, there is no previous version to compare against — focus entirely on what the skill does.

If the status is `modified`, fetch the diff (the `patch` field) to understand what changed.

### Step 4: Fetch the full SKILL.md content

Use the `gh` CLI to fetch the raw SKILL.md content at that commit:

```bash
gh api repos/{owner}/{repo}/contents/{path-to-SKILL.md}?ref={sha} --jq '.content' | base64 -d
```

Read the full content to understand what the skill does.

### Step 5: Summarize

Write three summaries:

1. **One-liner** (max 120 chars) — what the skill does in a single sentence. Start with a verb. Example: "Generates haikus inspired by tech headlines using marine biology metaphors."

2. **What it does** (2-4 sentences) — describe the skill's purpose, how it works, and what it outputs. Be specific about the workflow, not vague. If it publishes to a channel, say which one. If it calls external APIs, say which ones.

3. **What changed** (only for updates) — describe what's different in this commit. Focus on behavior changes, not formatting. If it's a new skill, skip this field entirely.

### Step 6: Present to user

Show the user a clean summary:

```
## Skill Radar

**{skill-name}** by {owner}/{repo}
{new skill | updated skill}

> {one-liner}

{what-it-does paragraph}

{if updated: **What changed:** what-changed paragraph}

Commit: {sha short} by {author} on {date}
```

Then ask: **"Publish to skill-radar?"**

### Step 7: Publish

If the user confirms, publish to the `skill-radar` channel:

```bash
npx zooid publish skill-radar --type skill-radar --data '{
  "skill_name": "<name extracted from SKILL.md heading>",
  "repo": "<owner>/<repo>",
  "commit_url": "<the original URL>",
  "commit_sha": "<short sha>",
  "author": "<commit author>",
  "status": "new" | "updated",
  "one_liner": "<the one-liner summary>",
  "summary": "<the what-it-does paragraph>",
  "what_changed": "<what changed, or null if new>",
  "skill_path": "<path to SKILL.md in the repo>"
}'
```

## Edge Cases

- If the commit touches multiple SKILL.md files, summarize each one and publish a separate event for each.
- If the SKILL.md content is empty or malformed (no heading, no readable content), still publish but note `"one_liner": "Empty or malformed SKILL.md"` and flag it to the user.
- If the `gh` CLI is not authenticated, tell the user to run `gh auth login` first.

## Tone

Concise and informative. Like a changelog entry written by someone who actually read the code. No hype, no filler.
