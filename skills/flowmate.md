# flowmate

Start a FlowMate session to track the current work.

## Steps

### 1. Ask for the task name

Ask the user: **"What should I call this task?"**

If they've already described what they want to build, suggest that as the default.

### 2. Create the session with one command

```bash
~/.bun/bin/bun /Users/avjeetsingh/GPT/CoderBro/flowmate/bin/flowmate.ts new "<task name>"
```

### 3. Confirm to the user

Just say: **"Session started: '[task name]' — dashboard is open at http://localhost:7843"**

Do not show any other output or commands.
