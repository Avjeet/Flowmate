# flowmate-fetch-comments

Triggered after the user selects comments in the FlowMate **Review** tab and clicks "Fix Selected". Reads the queued comments from FlowMate and applies targeted fixes.

## Steps

### 1. Fetch pending comments from FlowMate

```bash
SESSION_ID=$(cat ~/.flowmate/sessions/active)
COMMENTS=$(curl -s http://localhost:7842/api/sessions/${SESSION_ID}/pending-comments)
echo $COMMENTS
```

If the response is an empty array `[]`, tell the user no comments are queued and stop.

### 2. Update state to FIX_COMMENTS

```bash
curl -s -X POST http://localhost:7842/api/sessions/${SESSION_ID}/event \
  -H "Content-Type: application/json" \
  -d '{"phase":"FIX_COMMENTS","event":"fixing_pr_comments"}'
```

### 3. For each comment, apply a targeted fix

For each comment in the list:
- Read the `file` and `line` fields to locate the exact location
- Read the `body` to understand the reviewer's request
- Apply the **minimum change** that satisfies the comment
- Do NOT refactor, rename, or change anything outside the scope of the comment
- If a comment is ambiguous, ask the user before applying

### 4. After all fixes, run tests

If a test runner is configured (`bun test`, `npm test`, `pytest`, etc.), run tests to verify nothing broke.

### 5. Return to REVIEWING state

```bash
curl -s -X POST http://localhost:7842/api/sessions/${SESSION_ID}/event \
  -H "Content-Type: application/json" \
  -d '{"phase":"REVIEWING","event":"comments_fixed"}'
```

### 6. Clear the pending comments queue

```bash
curl -s -X POST http://localhost:7842/api/sessions/${SESSION_ID}/pending-comments \
  -H "Content-Type: application/json" \
  -d '{"comments":[]}'
```

### 7. Summary

Tell the user which comments were fixed, which were skipped, and suggest committing the fixes with `/flowmate-commit-push`.

## Rules

- Only fix what the comment says. No scope creep.
- If a file or line referenced no longer exists, flag it to the user.
- Never mark a comment as "resolved" on GitLab — that's the reviewer's job.
