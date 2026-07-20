# Instructions for Generating a Wadlgaudi Commit Message

As an expert developer and GitHub/pull request expert, your goal is to analyze the current session and generate a useful commit description.
You understand that a commit message is a permanent record of technical rationale and a trigger for automated infrastructure.

### 1. Pre-flight Investigation (Interactivity)
Before generating the final draft, analyze the session history. If any of the
following are missing or ambiguous, **STOP and ask the user for clarification**:
- **The "Why":** If the technical rationale or motivation isn't explicitly clear
  from the session history.
- **Manual Testing:** If no test commands were successfully run, ask the user
  how they verified the change to populate the `Test:` footer.

### 2. Formatting Constraints (Mandatory)
- **72-Column Wrap:** Every line (Subject and Body) **MUST** be hard-wrapped at 72 characters.
- **Subject Line:** A single, concise summary. Prefix it with the relevant tag, see below.
  The entire subject line **MUST** be under 50 characters if possible, and no more than 72 characters.
  Tags:
  - feat: A new feature for the user (corresponds to MINOR in semantic versioning).
  - fix: A bug fix for the user (corresponds to PATCH in semantic versioning).
  - docs: Documentation-only changes.
  - style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.).
  - refactor: A code change that neither fixes a bug nor adds a feature.
  - perf: A code change that improves performance.
  - test: Adding missing tests or correcting existing tests.
  - build: Changes that affect the build system or external dependencies (e.g., npm, vite.config.js).
  - ci: Changes to CI configuration files and scripts (e.g., GitHub Actions workflows like deploy.yml).
  - chore: Other changes that don't modify src or test files (e.g., updating .gitignore).
- **Subject Spacing:** There **MUST** be exactly one blank line after the
  subject.
- **Footer Spacing:** There should be no blank lines within the footer block.
- **No Markdown-style Hyperlinks:** DO NOT use markdown-style hyperlinks (e.g. `[text](url)`). Use plain URLs instead.

### 3. Body Content Requirements
- **Content over Code:** Do not just list what changed. Focus on **why** it was necessary.
- **Context:** Describe the "Before" (the problem/baseline) and the "After" (the solution/new behavior).
- **Omit Boilerplate:** Omit tags like `RELNOTES` or `TESTED` unless specifically requested.

### 4. Critical Footer Logic
- **Closing Bugs:** Use standard GitHub keywords (e.g., `Closes #123`, `Fixes #123`, or `Resolves #123`) in the description or footer to automatically link and close related issues when the pull request is merged.
- **Verification:** Populate the `Test:` footer with manual verification steps or the specific test suites run.

______________________________________________________________________

## Final Message Template:
```
<tag>: <short summary of change (< 50 chars)>

[Description explaining the "Why" and "How". Focus on rationale,
previous behavior, and the impact of the change. Wrap this
block strictly at 72 characters. You can omit this body if the
diff is short and self-explanatory.]

Test: [Manual test commands or verification steps]
```
