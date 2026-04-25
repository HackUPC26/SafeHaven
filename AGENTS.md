# SafeHaven Agent Instructions

This project uses BMAD Method.

BMAD files are located in:
- `_bmad/` for agents, workflows, tasks, and config
- `_bmad-output/` for generated planning and implementation artifacts

When the user mentions any `bmad-*` command, do not treat it as a shell command.
Instead:
1. Search `_bmad/` for the matching workflow, agent, task, or instructions.
2. Read the relevant BMAD files.
3. Follow the BMAD workflow as closely as possible.
4. Save outputs under `_bmad-output/` where appropriate.
5. At the end, recommend the next BMAD workflow.

Important BMAD commands:
- bmad-help
- bmad-create-prd
- bmad-create-architecture
- bmad-create-epics-and-stories
- bmad-sprint-planning
- bmad-create-story
- bmad-dev-story
- bmad-code-review
