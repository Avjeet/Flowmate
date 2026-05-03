# flowmate-fix-comments

Triggered by the FlowMate dashboard "Fix Comments" button. Fetches the selected GitLab MR comments queued by the server and applies targeted fixes.

## Steps

1. Fetch the pending comments from FlowMate server:

```bash
COMMENTS=$(curl -s http://localhost:7842/api/sessions/$(cat ~/.flowmate/sessions/active)/pending-comments)
```

2. If no comments are pending, inform the user and exit.

3. For each pending comment (already selected by the user in the dashboard):
   - Read the file and line referenced in the comment
   - Understand the reviewer's intent
   - Apply the minimal fix that addresses the comment
   - Do NOT refactor unrelated code

4. After applying all fixes, report back to FlowMate:

```bash
curl -s -X POST http://localhost:7842/api/sessions/$(cat ~/.flowmate/sessions/active)/event \
  -H "Content-Type: application/json" \
  -d '{"phase": "FIX_COMMENTS", "event": "comments_fixed"}'
```

5. Summarize what was changed for each comment.

## Important

- Only fix what the comments ask. Do not take initiative beyond the comment scope.
- If a comment is ambiguous, ask the user for clarification before applying.
- Return to REVIEWING phase after fixes are complete.
