---
name: "[SkillName]"
description: "WHAT this skill does. WHEN to use it. Trigger phrases: 'trigger phrase 1', 'trigger phrase 2'."
version: "1.0.0"
author: "[Your Name]"
tags: ["category1", "category2"]
---

# [SkillName]

> **Brief one-line description of what this skill accomplishes.**

## When to Use This Skill

Use this skill when you need to:
- **[Condition 1]**: Description of when this applies
- **[Condition 2]**: Description of when this applies
- **[Condition 3]**: Description of when this applies

**Trigger phrases:**
- "/[skill-name]" - Primary command
- "[Alternative phrase]" - Alternative way to invoke

**Do NOT use this skill when:**
- [Condition when NOT to use]
- [Another condition when NOT to use]

## Prerequisites

- [Requirement 1]
- [Requirement 2]
- [Optional requirement]

## Instructions

### Step 1: [First Step Name]

[Detailed instructions for the first step]

```bash
# Example command if applicable
command-example
```

### Step 2: [Second Step Name]

[Detailed instructions for the second step]

**Key considerations:**
- [Important note 1]
- [Important note 2]

### Step 3: [Completion/Verification]

[How to verify the step was completed successfully]

## Expected Output

[Describe what the user should expect as output - format, structure, examples]

**Example output:**
```
[Show example of what success looks like]
```

## Error Handling

If you encounter [specific error]:
- [Solution or workaround]

If you encounter [another error]:
- [Solution or workaround]

## Quality Checklist

Before considering this task complete:
- [ ] [Verification criterion 1]
- [ ] [Verification criterion 2]
- [ ] [Verification criterion 3]
- [ ] [Final validation step]

## Common Pitfalls

| Pitfall | Why it happens | How to avoid |
|---------|----------------|--------------|
| [Pitfall 1] | [Explanation] | [Prevention] |
| [Pitfall 2] | [Explanation] | [Prevention] |

## Related Skills

- **[RelatedSkill]**: [Brief description of relationship]
- **[AnotherSkill]**: [Brief description of relationship]

## Related Agents

| Agent | Nickname | Purpose |
|-------|----------|---------|
| [agent-file.md] | [Nickname] | [Purpose] |

## Notes

[Additional notes, context, or important information that doesn't fit elsewhere]

---

## Template Guide

### Customization Instructions

1. **Replace all `[PLACEHOLDER]` markers** with your skill-specific content
2. **YAML Frontmatter** is required - keep the `---` delimiters
3. **Required fields**: `name`, `description`
4. **Optional fields**: `version`, `author`, `tags`

### Description Format

Your description should answer three questions:
- **WHAT**: What does the skill do?
- **WHEN**: When should someone use it?
- **TRIGGERS**: What phrases should invoke it?

Example good description:
> "Creates Azure Function HTTP endpoints following project patterns. Use when adding new API routes. Triggers: 'create endpoint', 'add function', 'new API route'."

### Sections Overview

| Section | Required | Purpose |
|---------|----------|---------|
| When to Use | Yes | Clear guidance on when to invoke this skill |
| Prerequisites | Optional | Requirements before using the skill |
| Instructions | Yes | Step-by-step workflow |
| Expected Output | Recommended | What success looks like |
| Error Handling | Optional | Common issues and solutions |
| Quality Checklist | Recommended | Self-validation steps |
| Common Pitfalls | Optional | Prevention guide |
| Related Skills/Agents | Optional | Cross-references |
