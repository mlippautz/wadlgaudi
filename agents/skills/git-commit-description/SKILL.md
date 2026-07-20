---
name: git-commit-description
description: Use this skill to draft, write, or format a Changelist description or commit message strictly following the project's guidelines. Trigger this whenever the user needs help documenting their code changes for review, even if they don't explicitly mention change list or pull request. Do not use this skill for formatting code, explaining logic, or performing general code reviews.
---

Follow the instructions in the file `./git-commit-description.md` carefully to generate the commit description.
Ensure that all the constraints specified in the template are met.

### Programmatic Line Wrapping Rule (Mathematical Wrapping)
Because LLMs cannot reliably hard-wrap text at precisely 72 characters, you **MUST** mathematically format your draft before presenting the final response.
Use the provided Python script `./scripts/wrap_lines.py` via your execution tools.
Pre-requisite: Save your draft to a file (e.g. `draft.txt`).
Example usage: `vpython3 ./scripts/wrap_lines.py draft.txt` from the current directory.
Final output should be the code block containing the mathematically formatted text.
