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

### Step 6: Update TEAM.md File

After creating the new agent file, update `.claude/agents/TEAM.md` to include the new agent in the team coordination documentation.

**Read TEAM.md to understand current structure:**
```
Read .claude/agents/TEAM.md
```

**6.1. Determine Agent Level:**

Ask the user to classify the new agent using `AskUserQuestion`:

| Level | Description | Example | Section in TEAM.md |
|-------|-------------|---------|-------------------|
| Level 1: Orchestrator | Top-level coordinator | orchestrator.md | Agent Hierarchy (Level 1) |
| Level 2: Lead | Technical/Implementation lead | architect.md, planner.md | Lead Agents section |
| Level 2: Coordination | Multi-agent coordination | chinese-foreman.md | Coordination Agents section |
| Level 3: Specialist | Domain-specific specialist | frontend.md, backend.md | Specialist Agents table |
| Utility | Support utility | internet-researcher.md | Utility Agents section |

**6.2. Update Agent Hierarchy Section:**

Based on agent level, update the appropriate section:

- **For Level 3: Specialist Agents**: Add a row to the table at line ~101
  ```markdown
  | [Agent Name] Agent | [Role description] | `[filename].md` | [Scope] | [Reports To] |
  ```

  Example:
  ```markdown
  | My New Agent | Does something specific | `my-new-agent.md` | Specific domain only | Architect (domain), Planner (implementation) |
  ```

- **For Utility Agents**: Add a new entry after line ~137
  ```markdown
  #### [Agent Name] Agent ([Nickname])
  - **Role**: [One-line role description]
  - **File**: `.claude/agents/[filename].md`
  - **Responsibilities**: [3-5 key responsibilities]
  - **Supports**: [Which agents this agent supports]
  - **Use When**: [When to use this agent]
  ```

**6.3. Update "When to Involve Each Agent" Table:**

Add trigger rows at line ~307 in the Quick Reference section:
```markdown
| [Trigger scenario] | [Agent Name] Agent (direct or coordinated) |
```

Example:
```markdown
| Do something specific | My New Agent (direct) |
```

**6.4. Update File Structure Section:**

Add the file entry at line ~350:
```markdown
├── [filename].md                   ([Level]: [Type] - [Brief description])
```

Example:
```markdown
├── my-new-agent.md                 (Level 3: Specialist - Specific domain)
```

**6.5. Optional: Update Team Structure ASCII:**

If creating a Level 2 Coordination or Utility agent, add a box to the ASCII diagram at line ~35. This is NOT needed for Level 3 Specialist agents.

**6.6. Optional: Add Coordination Protocol:**

If the specialist agent requires cross-domain coordination (similar to Auth & Security or Logging & Monitoring agents), add a new protocol after line ~262 following the Protocol pattern. Most new agents will NOT need this.

**6.7. Optional: Update Tools and Permissions:**

If the agent has custom tool/permission requirements beyond the standard specialist agent tools, add an entry at line ~370. Most agents will use standard specialist agent tools and permissions.

## Expected Output

**Success:**
```
Agent file created at: .claude/agents/feature-implementer.md

Display Name: Feature Implementation
Nickname: Tony
Purpose: Implement new features following established patterns
Category: features (color: green)

TEAM.md Updated:
- Added to Specialist Agents table (Level 3)
- Added trigger to "When to Involve Each Agent" table
- Added entry to File Structure section

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
- [ ] Agent level determined (Level 1, Level 2, Level 3, or Utility)
- [ ] Agent entry added to `.claude/agents/TEAM.md` in appropriate section:
  - [ ] Specialist Agents table (for Level 3) OR Utility Agents section (for Utility)
  - [ ] "When to Involve Each Agent" table (trigger row added)
  - [ ] File Structure section (file entry added)

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
- **TEAM.md Integration**: After creating a new agent, always update `.claude/agents/TEAM.md` to include the new agent. This ensures the agent team documentation stays synchronized with the actual agent files and enables proper task routing by the Orchestrator agent.

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
