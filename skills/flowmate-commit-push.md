# flowmate-commit-push

Triggered by the **Commit & Push** button in the FlowMate dashboard. Summarizes all uncommitted changes, creates a conventional commit, pushes to the remote, creates a GitLab MR (if configured), and stores the MR/PR URL in FlowMate.

## Steps

### 1. Update dashboard state to COMMITTING

```bash
SESSION_ID=$(cat ~/.flowmate/sessions/active)
curl -s -X POST http://localhost:7842/api/sessions/${SESSION_ID}/event \
  -H "Content-Type: application/json" \
  -d '{"phase":"COMMITTING","event":"starting_commit"}'
```

### 2. Understand the changes

Run `git diff HEAD` and `git status` to understand:
- What files were added/modified/deleted
- The overall scope and purpose of the changes

### 3. Write a conventional commit message

Based on the diff, write a commit message following the format:
```
<type>(<scope>): <short summary>

<body — 2-3 sentences explaining what changed and why>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`

Example:
```
feat(auth): add JWT-based user authentication

Implemented login, logout, and token refresh endpoints using jsonwebtoken.
Added middleware for protecting routes. Tokens expire after 24h.
```

### 4. Stage and commit

```bash
git add -A
git commit -m "<your commit message>"
```

### 5. Push to remote

```bash
git push
```

If the branch has no upstream yet:
```bash
git push --set-upstream origin $(git branch --show-current)
```

### 6. Create GitLab MR (if GitLab is configured)

Check if GitLab is configured:
```bash
curl -s http://localhost:7842/api/config | grep -q '"gitlab"' && echo "configured"
```

If configured, create an MR via the GitLab API:
```bash
BRANCH=$(git branch --show-current)
SESSION=$(curl -s http://localhost:7842/api/sessions/active)
REPO=$(echo $SESSION | bun -e "const d=await Bun.stdin.json();console.log(d?.meta?.gitlabRepo??'')")
CONFIG=$(curl -s http://localhost:7842/api/config)
GITLAB_HOST=$(echo $CONFIG | bun -e "const d=await Bun.stdin.json();console.log(d?.integrations?.gitlab?.host??'gitlab.com')")
GITLAB_TOKEN=$(echo $CONFIG | bun -e "const d=await Bun.stdin.json();console.log(d?.integrations?.gitlab?.token??'')")

# Create MR
MR=$(curl -s -X POST "https://${GITLAB_HOST}/api/v4/projects/$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$REPO")/merge_requests" \
  -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"source_branch\":\"${BRANCH}\",\"target_branch\":\"main\",\"title\":\"Draft: <your commit summary>\"}")

MR_URL=$(echo $MR | bun -e "const d=await Bun.stdin.json();console.log(d?.web_url??'')")
```

### 7. Store MR URL + transition to REVIEWING

```bash
curl -s -X POST http://localhost:7842/api/sessions/${SESSION_ID}/commit \
  -H "Content-Type: application/json" \
  -d "{\"mrUrl\":\"${MR_URL}\"}"
```

If no GitLab (GitHub or no remote VCS):
```bash
curl -s -X POST http://localhost:7842/api/sessions/${SESSION_ID}/commit \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 8. Confirm to the user

Tell the user:
- What was committed and the commit hash
- The MR/PR URL (if created)
- That the dashboard has moved to Review state
