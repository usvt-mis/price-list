# Claude Code Skill Template

This is a universal template for creating Claude Code skills. Use it as a starting point for building new skills that follow Claude Code's skill pattern and best practices.

## What is a Claude Code Skill?

A **skill** is a reusable prompt template that can be invoked with a slash command (e.g., `/commit`, `/review-pr`). Skills are stored as markdown files in `.claude/skills/` and injected into conversation context when invoked.

### Skill Structure

```
.claude/skills/
├── [skill-name]/
│   └── SKILL.md          # Main skill file (required)
├── another-skill/
│   ├── SKILL.md
│   └── resources/        # Optional supporting files
│       └── example.txt
└── template/
    ├── SKILL.md          # This template
    └── README.md         # This file
```

## Creating a New Skill

### Step 1: Copy the Template

Create a new directory for your skill and copy the template:

```bash
# Create skill directory
mkdir -p .claude/skills/my-skill

# Copy template
cp .claude/skills/template/SKILL.md .claude/skills/my-skill/
```

### Step 2: Customize Frontmatter

Edit the YAML frontmatter at the top of `SKILL.md`:

```yaml
---
name: "MySkill"
description: "WHAT it does. WHEN to use it. Triggers: 'phrase 1', 'phrase 2'."
version: "1.0.0"
author: "Your Name"
tags: ["category", "another-category"]
---
```

**Required fields:**
- `name` - Short, memorable name (PascalCase recommended)
- `description` - WHAT + WHEN + trigger phrases

**Optional fields:**
- `version` - SemVer version string
- `author` - Creator name
- `tags` - Array of category tags

### Step 3: Replace Placeholders

Search through the template and replace all `[PLACEHOLDER]` markers:

| Placeholder | Purpose |
|-------------|---------|
| `[SkillName]` | Display name in headings |
| `[skill-name]` | Command name (lowercase, kebab-case) |
| `[Condition N]` | When to use conditions |
| `[Step N]` | Workflow steps |

### Step 4: Test Your Skill

Invoke your skill in Claude Code:

```
/[skill-name]
```

Verify the skill loads and provides expected guidance.

## Best Practices

### 1. Single Responsibility

Each skill should do **one thing well**. If your skill has multiple unrelated functions, consider splitting it.

| Good | Bad |
|------|------|
| `/commit` - Git commits only | `/git` - Commits, push, pull, branches |
| `/docs` - Documentation sync only | `/all` - Documentation + tests + linting |

### 2. Clear Trigger Phrases

Your description should include explicit trigger phrases. This helps Claude Code determine when to invoke your skill.

**Good description:**
```
"Creates Azure Function endpoints following project patterns.
Use when adding new API routes. Triggers: 'create endpoint', 'add function', 'new API'."
```

**Bad description:**
```
"A skill for creating things."
```

### 3. Use Section Headers

Organize your skill with clear markdown headers:

```markdown
## When to Use This Skill
## Instructions
## Expected Output
## Error Handling
## Quality Checklist
```

### 4. Provide Examples

Show concrete examples of:
- Command usage
- Expected output
- Common scenarios

### 5. Include Self-Validation

Add a quality checklist so users can verify successful completion:

```markdown
## Quality Checklist

Before considering this task complete:
- [ ] All files compile without errors
- [ ] Tests pass
- [ ] Documentation updated
```

## Skill Invocation

Skills are invoked in three ways:

### 1. Slash Command (Primary)

```
/[skill-name]
```

### 2. Natural Language

Claude Code may invoke based on description matches:

> "Can you help me [trigger phrase]?"

### 3. Direct Reference

You can reference a skill by name in conversation:

> "Use the [SkillName] skill for this task."

## Template Sections

| Section | Purpose | Required |
|---------|---------|----------|
| YAML Frontmatter | Metadata and discovery | Yes |
| When to Use | Clear invocation guidance | Yes |
| Prerequisites | Requirements before use | No |
| Instructions | Step-by-step workflow | Yes |
| Expected Output | Success criteria | Recommended |
| Error Handling | Common issues and fixes | No |
| Quality Checklist | Self-validation | Recommended |
| Common Pitfalls | Prevention guide | No |
| Related Skills/Agents | Cross-references | No |

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Agent Skills Specification](https://agentskills.io/specification) - Open standard
- [anthropics/skills](https://github.com/anthropics/skills) - Official examples

## Example Skills

To see examples of production-ready skills, reference:

- **Update Skill** (`.claude/skills/update/skill.md`) - Documentation synchronization
- **Brainstorm Skill** (`.claude/skills/bs/skill.md`) - Multi-agent coordination

## Troubleshooting

### Skill Not Found

If your skill isn't found:
1. Verify directory structure: `.claude/skills/[name]/SKILL.md`
2. Check file is named exactly `SKILL.md` (uppercase)
3. Verify YAML frontmatter is present and valid

### YAML Parsing Error

If frontmatter has errors:
1. Use a YAML validator to check syntax
2. Ensure `---` delimiters are present
3. Check for proper quoting and indentation

### Skill Not Invoking

If skill doesn't trigger on natural language:
1. Review your description for clarity
2. Add explicit trigger phrases
3. Make sure the description answers WHAT + WHEN

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-02-21 | Initial template release |
