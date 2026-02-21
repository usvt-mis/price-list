---
name: "AddSkills"
description: "Create new Claude Code skills from a standardized template. Use when the user wants to create a new skill and needs to define its name, description, and structure. Trigger phrases: 'create a new skill', 'add a skill', 'make a skill', 'define skill', 'new skill'."
version: "1.0.0"
author: "Claude Code"
tags: ["skill-management", "template", "code-generation"]
---

# AddSkills

> A skill generator that helps you create new Claude Code skills from a standardized template.

## When to Use This Skill

Use this skill when you need to:
- **Create a new skill**: Define and generate a new Claude Code skill based on the project template
- **Standardize skill structure**: Ensure new skills follow consistent patterns and conventions
- **Bootstrap skill development**: Get started quickly with a pre-structured template

**Trigger phrases:**
- `/add-skills` - Primary command
- "create a new skill" - Natural language trigger
- "add a skill" - Natural language trigger
- "make a skill" - Natural language trigger
- "define skill" - Natural language trigger

**Do NOT use this skill when:**
- Modifying an existing skill (use Edit tool directly)
- Creating agents (use agent template instead)
- The `.claude/skills/` directory structure doesn't exist

## Prerequisites

- `.claude/skills/template/SKILL.md` must exist in the codebase
- Write permissions to `.claude/skills/` directory
- Valid kebab-case name for the new skill

## Instructions

### Step 1: Collect User Input

Ask the user for the following required information:

**Required Fields:**
1. **Name** (`name`): Short, lowercase, kebab-case skill name (e.g., "refactor", "test-helper", "api-docs")
   - Must match pattern: `^[a-z][a-z0-9-]*[a-z0-9]$`
   - No spaces, no uppercase letters, no special characters except hyphen
   - Examples: `commit`, `code-review`, `azure-function`, `doc-sync`

2. **Description** (`description`): Clear description answering three questions:
   - **WHAT**: What does the skill do?
   - **WHEN**: When should someone use it?
   - **TRIGGERS**: What phrases should invoke it?

   Example: "Creates Azure Function endpoints following project patterns. Use when adding new API routes. Triggers: 'create endpoint', 'add function', 'new API route'."

**Optional Fields:**
3. **Author** (`author`): Creator name (default: empty)
4. **Version** (`version`): SemVer version string (default: "1.0.0")
5. **Tags** (`tags`): Array of category tags (default: empty array)

### Step 2: Validate Input

Perform validation before proceeding:

```bash
# Check if name is valid kebab-case
# Pattern: starts with lowercase letter, contains only lowercase letters, numbers, and hyphens
```

**Validation checks:**
- [ ] Name is valid kebab-case (no spaces, no uppercase, starts/ends with alphanumeric)
- [ ] Directory `.claude/skills/{name}/` does NOT already exist
- [ ] Description includes WHAT component (what the skill does)
- [ ] Description includes WHEN component (when to use it)
- [ ] Description includes trigger phrases

If validation fails, inform the user and allow correction.

### Step 3: Read Template

Read the skill template from `.claude/skills/template/SKILL.md`.

### Step 4: Process Template

Replace all placeholders in the template:

| Placeholder | Replacement Value |
|-------------|-------------------|
| `[SkillName]` | PascalCase version of name (capitalize first letter and each word after hyphen) |
| `[skill-name]` | Original lowercase kebab-case name |
| `[DESCRIPTION]` | User-provided description (in YAML frontmatter) |
| `[AUTHOR]` | User-provided author or empty string |
| `[VERSION]` | User-provided version or "1.0.0" |
| `[TAGS]` | User-provided tags as YAML array or empty array `[]` |

**PascalCase conversion rule:**
- `test-helper` → `TestHelper`
- `api-docs` → `ApiDocs`
- `code-review` → `CodeReview`
- `azure-function` → `AzureFunction`

### Step 5: Create Directory and Write Skill

1. Create the skill directory: `.claude/skills/{name}/`
2. Write the processed content to: `.claude/skills/{name}/skill.md`

**Important**: The file name should be `skill.md` (lowercase), not `SKILL.md` (uppercase).

### Step 6: Verify Creation

Confirm the skill was created successfully:
- Directory exists: `.claude/skills/{name}/`
- File exists: `.claude/skills/{name}/skill.md`
- YAML frontmatter is valid
- Placeholders were correctly replaced
- Template structure is preserved

## Expected Output

Upon successful completion, report:

```
Skill created successfully!

Location: .claude/skills/{name}/skill.md
Name: {name}
Description: {description}

Next steps:
1. Open the skill file and customize the instructions
2. Replace remaining [PLACEHOLDER] markers with skill-specific content
3. Test the skill by invoking: /{name}
```

**Example success output:**
```
Skill created successfully!

Location: .claude/skills/code-review/skill.md
Name: code-review
Description: Reviews code changes against project patterns and best practices. Use when reviewing PRs or changes. Triggers: 'review code', 'check PR', 'code review'.

Next steps:
1. Open the skill file and customize the instructions
2. Replace remaining [PLACEHOLDER] markers with skill-specific content
3. Test the skill by invoking: /code-review
```

## Error Handling

**If directory already exists:**
- Error: "Skill directory `.claude/skills/{name}/` already exists. Please choose a different name or delete the existing directory."
- Solution: Use a different name or remove existing directory first

**If invalid kebab-case name:**
- Error: "Invalid skill name '{name}'. Names must be kebab-case (lowercase, numbers, hyphens only; must start with letter)."
- Solution: Provide a valid name following the pattern

**If template file not found:**
- Error: "Template file `.claude/skills/template/SKILL.md` not found. Please ensure the template exists."
- Solution: Create the template file or check the path

**If description is incomplete:**
- Warning: "Description should include WHAT the skill does, WHEN to use it, and trigger phrases. Current description may be incomplete."
- Solution: Ask user to provide a more complete description

## Quality Checklist

Before considering this task complete:
- [ ] Collected all required fields (name, description)
- [ ] Validated name is kebab-case
- [ ] Confirmed directory doesn't already exist
- [ ] Verified description includes WHAT + WHEN + triggers
- [ ] Read template file successfully
- [ ] Created skill directory
- [ ] Wrote skill.md with replaced placeholders
- [ ] Verified file was created at correct path
- [ ] Reported success with next steps to user

## Common Pitfalls

| Pitfall | Why it happens | How to avoid |
|---------|----------------|--------------|
| Uppercase letters in name | User provides PascalCase or camelCase | Explicitly validate and request kebab-case |
| Missing template | Template file path is incorrect | Check template exists before processing |
| Existing directory | Skill name already in use | Validate directory doesn't exist before creating |
| Incomplete description | User provides minimal description | Require WHAT + WHEN + triggers components |
| Wrong filename | Using SKILL.md instead of skill.md | Use lowercase `skill.md` as per convention |

## Related Skills

- **template**: Base template for all skills

## Related Agents

| Agent | Nickname | Purpose |
|-------|----------|---------|
| N/A | N/A | This is a skill generator, not an agent |

## Notes

**Project-Agnostic Design**: This skill is designed to work across any codebase that has the `.claude/skills/template/SKILL.md` template file. It does not depend on project-specific patterns.

**Template Preservation**: The skill preserves all template sections and placeholders, only replacing the essential metadata fields. Users are expected to fill in skill-specific instructions manually.

**File Naming Convention**: Claude Code skills use lowercase `skill.md` filenames, while the template uses uppercase `SKILL.md` to distinguish it as a template source.

**Directory Structure**: Skills are organized as `.claude/skills/{skill-name}/skill.md` to allow for additional resources (examples, docs) in the same directory in the future.

---

## Implementation Notes for Claude

When executing this skill:
1. Use the `AskUserQuestion` tool for collecting user input (name, description, optional fields)
2. Use `Glob` to check if directory already exists: `.claude/skills/{name}/*`
3. Use `Read` to read the template file
4. Use string manipulation to replace placeholders and convert kebab-case to PascalCase
5. Use `Bash` to create the directory
6. Use `Write` to create the skill file
7. Provide clear feedback at each step
