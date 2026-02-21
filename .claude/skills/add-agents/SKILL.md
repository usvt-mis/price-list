---
name: AddAgent
description: Creates new agent files in .claude/agents/ directory using the universal template. Use this agent when you need to add a new specialized agent for task delegation. Trigger phrases: '/add-agents', 'add agent', 'create agent', 'new agent'.
version: "1.0.0"
author: "Claude Code"
tags: ["agent-creation", "template", "code-generation"]
---

# AddAgent

> Streamlines the process of creating new agent files in the `.claude/agents/` directory by gathering metadata and generating properly formatted agent files from the universal template.

## When to Use This Skill

Use this skill when you need to:
- **Create a new agent file**: Add a new specialized agent to `.claude/agents/` following the universal template structure
- **Standardize agent creation**: Ensure all agents have consistent YAML frontmatter, structure, and formatting
- **Delegate repetitive tasks**: Set up agents for workflows you perform frequently

**Trigger phrases:**
- "/add-agents" - Primary command
- "add agent" - Create a new agent
- "create agent" - Create a new agent
- "new agent" - Create a new agent

**Do NOT use this skill when:**
- Modifying an existing agent (use direct editing instead)
- Creating a skill (skills have a different format in `.claude/skills/`)
- Working with agents outside the `.claude/agents/` directory

## Prerequisites

- Universal template must exist at `.claude/agents/Template.md`
- `.claude/agents/` directory must exist

## Instructions

### Step 1: Gather Agent Metadata

Ask the user for the following information using `AskUserQuestion`:

| Field | Description | Example |
|-------|-------------|---------|
| Display Name | Title Case name for the agent | "Feature Implementation" |
| Nickname | Memorable short name for quick reference | "Tony" |
| File Name | kebab-case filename | "feature-implementer.md" |
| Purpose | One-sentence summary of what the agent does | "Implement new features following established patterns" |
| Category | Agent type (determines color) | "features" |

**Category Options and Colors:**

| Category | Color | Use For |
|----------|-------|---------|
| debugging | red | Diagnosing errors, debugging issues |
| features | green | Implementing new features, creating endpoints |
| maintenance | blue | Refactoring, optimization, batch processing |
| documentation | yellow | Documentation updates, syncing docs |
| research | purple | Internet research, gathering information |

### Step 2: Read the Universal Template

Read `.claude/agents/Template.md` to understand the structure. This is the source of truth for all agent files.

### Step 3: Generate the Agent File

Create the new agent file at `.claude/agents/{filename}.md` with:

**YAML Frontmatter:**
```yaml
---
name: "[Display Name from Step 1]"
description: "Use this agent when... [detailed description with trigger keywords]"
model: opus
color: "[color from category]"
---
```

**Header Section:**
```markdown
# [Display Name] Agent

**Nickname**: [Nickname from Step 1]
**Purpose**: [Purpose from Step 1]
```

**Body Sections:** Copy all 17 sections from the template, preserving the structure and placeholder text. The user will customize these later.

### Step 4: Validate the Output

Ensure:
- File name uses kebab-case (lowercase with hyphens)
- YAML frontmatter has valid syntax
- `name` in YAML matches the Display Name
- `description` starts with "Use this agent when..."
- `model` is set to "opus" (or user preference)
- `color` matches the selected category
- All template sections are preserved

### Step 5: Guide Customization

Inform the user that the agent file has been created and guide them through:
1. Filling in the "When to Use This Agent" section with specific scenarios
2. Defining "DO NOT Use" boundaries
3. Customizing "Core Responsibilities" for their domain
4. Adding architecture context if applicable
5. Specifying critical patterns and key concepts
6. Implementing the process flow
7. Defining output formats
8. Setting quality standards
9. Documenting edge cases
10. Writing common scenarios
11. Specifying tool usage
12. Setting logging prefixes
13. Referencing related agents
14. Writing an example session
15. Adding optional checklist or notes sections

### Step 6: Update BS Skill Agent List

After creating the new agent file, update the agent list in `.claude/skills/bs/skill.md` to include the new agent.

**Read the BS skill file:**
```
Read .claude/skills/bs/skill.md
```

**Locate the appropriate category section** under "## Agent List (All in `.claude/agents/` root)" and add the new agent:

**Category sections:**
- `### Translation Agent (1)` - For translation agents
- `### Debugging Agents (2)` - For debugging agents
- `### Feature Agents (5)` - For feature creation agents
- `### Maintenance Agents (5)` - For maintenance agents
- `### Documentation Agents (1)` - For documentation agents
- `### Research Agents (1)` - For research agents

**Entry format:**
```markdown
- `{filename}.md` ({Nickname}) - {Brief one-line description}
```

**Example:**
```markdown
### Feature Agents (5)
- `feature-implementer.md` (Tony) - Full-stack feature implementation (Functions → Services → Managers → BC API, 19+ BC API quirks, Sales Quote-Aware Batching)
- `endpoint-creator.md` (Alice) - Azure Function HTTP triggers (GET request parameter mode, validation patterns, DI registration)
- `my-new-agent.md` (MyNickname) - Brief description of what this agent does
```

**Important:** Update the count in parentheses for the category (e.g., `### Feature Agents (5)` → `### Feature Agents (6)`).

## Expected Output

**Success:**
```
Agent file created at: .claude/agents/feature-implementer.md

Display Name: Feature Implementation
Nickname: Tony
Purpose: Implement new features following established patterns
Category: features (color: green)

BS Skill Updated: Added to Feature Agents section in .claude/skills/bs/skill.md

Next steps:
1. Customize the "When to Use This Agent" section with specific trigger scenarios
2. Define "DO NOT Use" boundaries to prevent misuse
3. Fill in "Core Responsibilities" with 3-5 key responsibilities
4. Add domain-specific patterns to "Critical Patterns / Key Concepts"
5. Specify the implementation workflow in "Implementation Process Flow"
6. Continue customizing remaining sections based on your agent's purpose
```

**Example Generated File:**
```markdown
---
name: Feature Implementation
description: Use this agent when implementing new features following established patterns (Functions -> Services -> Managers -> BC API). Handles full-stack implementation across all layers with BC API quirks expertise.
model: opus
color: green
---

# Feature Implementation Agent

**Nickname**: Tony
**Purpose**: Implement new features following established patterns

## When to Use This Agent
[... rest of template sections ...]
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Template not found | `.claude/agents/Template.md` doesn't exist | Create the universal template first or verify path |
| Invalid category | User provided category not in the 5 defined | Ask user to select from: debugging, features, maintenance, documentation, research |
| File name not kebab-case | User provided PascalCase or spaces | Convert to lowercase with hyphens (e.g., "FeatureImplementer" → "feature-implementer") |
| File already exists | Agent with that filename already exists | Ask user to choose a different name or confirm overwrite |

## Quality Checklist

Before considering the agent creation complete:
- [ ] File name is kebab-case (lowercase with hyphens, no spaces)
- [ ] YAML frontmatter is valid (proper `---` delimiters, no syntax errors)
- [ ] `name` in YAML matches the Display Name (Title Case)
- [ ] `description` includes "Use this agent when..." phrase
- [ ] `model` is set to "opus" (or user-specified model)
- [ ] `color` matches the selected category palette
- [ ] All 17 template sections are present
- [ ] Nickname is memorable and short (1-2 words)
- [ ] Purpose is a clear one-sentence summary
- [ ] Agent entry added to `.claude/skills/bs/skill.md` in the correct category section
- [ ] Category count in BS skill updated (e.g., `### Feature Agents (5)` → `### Feature Agents (6)`)

## Common Pitfalls

| Pitfall | Why it happens | How to avoid |
|---------|----------------|--------------|
| Missing template sections | Copy-paste error | Verify all 17 sections from template are present |
| Invalid YAML syntax | Incorrect indentation or missing dashes | Validate YAML format before writing file |
| Wrong color for category | Confusion about color assignments | Use the category-color mapping table in Step 1 |
| File name case errors | Windows case-insensitive filesystem | Always use lowercase kebab-case explicitly |
| Description without "Use this agent when" | Missing trigger keywords | Start description with this exact phrase |

## Related Skills

- **template**: Reference for understanding skill file structure

## Related Agents

| Agent | Nickname | Purpose |
|-------|----------|---------|
| Template.md | N/A | Universal template for all agents |
| feature-implementer.md | Tony | Example of a features-category agent (green) |
| error-diagnostic.md | Sherlock | Example of a debugging-category agent (red) |
| performance-optimizer.md | Turbo | Example of a maintenance-category agent (blue) |
| docs-updater.md | Archivist | Example of a documentation-category agent (yellow) |
| internet-researcher.md | Scout | Example of a research-category agent (purple) |

## Notes

- **Project-Neutral Design**: This skill does not include project-specific patterns (BC API, Azure Functions, etc.) so it can be used across any codebase using the Claude Code agent template system.
- **Template Reference**: The universal template at `.claude/agents/Template.md` is the source of truth. Always read the current version rather than hardcoding template content.
- **Naming Conventions**:
  - File names: `kebab-case.md` (lowercase with hyphens)
  - Display names: Title Case (e.g., "Feature Implementation")
  - YAML `name` field: Title Case (matches display name)
- **Color Palette**: The 5-category color system provides visual distinction in agent listings. Choose the category that best matches the agent's primary purpose.
- **Post-Creation Customization**: The generated file is a starting point. Users should customize sections based on their agent's specific domain and workflow.
- **BS Skill Integration**: After creating a new agent, always update `.claude/skills/bs/skill.md` to include the new agent in the appropriate category section. This ensures the brainstorm skill can reference all available agents.

---

## Template Reference

### Category Color Palette

| Category | Color | Example Agents |
|----------|-------|----------------|
| debugging | red | error-diagnostic, bc-api-debugger |
| features | green | feature-implementer, endpoint-creator, manager-builder, model-creator, service-builder |
| maintenance | blue | batch-processor, code-refactorer, performance-optimizer, test-validator |
| documentation | yellow | docs-updater, documentation-sync |
| research | purple | internet-researcher |

### File Naming Examples

| Display Name | Nickname | File Name |
|--------------|----------|-----------|
| Feature Implementation | Tony | feature-implementer.md |
| Error Diagnostic | Sherlock | error-diagnostic.md |
| Performance Optimizer | Turbo | performance-optimizer.md |
| Documentation Updater | Archivist | docs-updater.md |
| Internet Researcher | Scout | internet-researcher.md |
