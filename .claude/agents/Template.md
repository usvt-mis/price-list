---
name: template-agent
description: [One-line purpose + trigger keywords for auto-discovery. Include: "Use this agent when..." phrases, technology names, task types, and action verbs]
model: opus
color: blue
---

# [Agent Display Name] Agent

**Nickname**: [Memorable short name for quick reference]
**Purpose**: [One-sentence summary of what this agent does]

## When to Use This Agent

Use this agent when you need to:
- [Specific scenario 1 with concrete trigger condition]
- [Specific scenario 2 with concrete trigger condition]
- [Specific scenario 3 with concrete trigger condition]

### DO NOT Use This Agent When
- [Scenario boundary 1] - Use [Other Agent] instead
- [Scenario boundary 2] - This is outside the agent's scope
- [Scenario boundary 3] - Direct implementation is simpler

## Core Responsibilities

1. **[Primary Responsibility 1]**
   - What it does
   - Why it matters

2. **[Primary Responsibility 2]**
   - What it does
   - Why it matters

3. **[Primary Responsibility 3]**
   - What it does
   - Why it matters

## Architecture Context (Optional)

<!-- Include this section if the agent works within a specific system architecture -->

<!--
[Diagram or text showing where this agent fits in the system]

Example:
```
Layer 1 -> Layer 2 -> This Agent -> Layer 3
```

### System Position
- Upstream dependencies: [What this agent depends on]
- Downstream consumers: [What depends on this agent]
- Parallel operations: [What can run concurrently]
-->

## Critical Patterns / Key Concepts

<!-- Include patterns that are essential for this agent's domain -->

### [Pattern Name 1]

**When to use**: [Specific condition or scenario]

**Description**: [How the pattern works]

**Implementation**:
```csharp
// Code example showing the pattern
var example = "implementation";
```

**Common mistakes**:
- Wrong: [Incorrect approach]
- Right: [Correct approach]

### [Pattern Name 2]

**When to use**: [Specific condition or scenario]

**Description**: [How the pattern works]

**Implementation**:
```csharp
// Code example showing the pattern
var example = "implementation";
```

**Anti-patterns to avoid**:
- [Anti-pattern 1]: Why it's wrong
- [Anti-pattern 2]: Why it's wrong

## Implementation Process Flow

<!--
Phase-by-phase workflow this agent follows
-->

### Phase 1: [Phase Name]
- [Step 1.1]
- [Step 1.2]
- [Step 1.3]

### Phase 2: [Phase Name]
- [Step 2.1]
- [Step 2.2]
- [Step 2.3]

### Phase 3: [Phase Name]
- [Step 3.1]
- [Step 3.2]
- [Step 3.3]

## Output Format

<!-- Expected output structure from this agent -->

### [Output Type 1]

```markdown
## [Section Name]
[Content format]

### [Subsection]
[Expected content structure]
```

### [Output Type 2]

```json
{
  "field1": "format description",
  "field2": "format description"
}
```

## Quality Standards

<!-- Validation criteria for this agent's output -->

### [Standard Category 1]
- [Criteria 1]
- [Criteria 2]
- [Criteria 3]

### [Standard Category 2]
- [Criteria 1]
- [Criteria 2]
- [Criteria 3]

### Anti-patterns to Avoid
- [What NOT to do 1]
- [What NOT to do 2]

## Edge Cases and Handling

<!-- Common edge cases with symptoms, detection, and resolution -->

### [Edge Case 1]

**Symptom**: [What the problem looks like]

**Detection**: [How to identify it]

**Resolution**: [How to fix it]

```csharp
// Example fix
var resolution = "implementation";
```

### [Edge Case 2]

**Symptom**: [What the problem looks like]

**Detection**: [How to identify it]

**Resolution**: [How to fix it]

```csharp
// Example fix
var resolution = "implementation";
```

## Common Scenarios

<!-- Detailed walkthroughs of typical use cases -->

### Scenario 1: [Scenario Name]

**Context**: [When this scenario occurs]

**Request Example**:
```
[User input that triggers this scenario]
```

**Process**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Output Example**:
```markdown
[Expected output format]
```

### Scenario 2: [Scenario Name]

**Context**: [When this scenario occurs]

**Request Example**:
```
[User input that triggers this scenario]
```

**Process**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Output Example**:
```markdown
[Expected output format]
```

## Tool Selection Guide

<!-- Which tools this agent uses and when -->

| Tool | When to Use | Notes |
|------|-------------|-------|
| [Tool Name 1] | [Specific use case] | [Additional context] |
| [Tool Name 2] | [Specific use case] | [Additional context] |
| [Tool Name 3] | [Specific use case] | [Additional context] |

### Tool Usage Patterns

<!-- Common tool combination patterns -->

**Pattern 1: [Pattern Name]**
```csharp
// Example of combining tools
var result1 = await Tool1Async();
var result2 = await Tool2Async(result1);
```

**Pattern 2: [Pattern Name]**
```csharp
// Example of parallel tool usage
await Task.WhenAll(
    Tool1Async(),
    Tool2Async(),
    Tool3Async()
);
```

## Logging Prefixes

<!-- Standardized logging prefixes for this agent -->

Use these prefixes for clear, filterable logs:
- `[PREFIX]` - [When to use]
- `[PREFIX][SUBPREFIX]` - [When to use]
- `[PREFIX][ANOTHER]` - [When to use]

## Related Agents

<!-- Cross-references to other agents -->

- **[agent-1.md]** ([Nickname]) - [When to use that agent instead]
- **[agent-2.md]** ([Nickname]) - [How it relates to this agent]
- **[agent-3.md]** ([Nickname]) - [What that agent handles vs. this one]

## Example Session

<!-- Full example of request, process, and output -->

**Request**:
```
[Example user request that would trigger this agent]
```

**Process**:
1. [Step 1 - What the agent does first]
2. [Step 2 - What the agent does next]
3. [Step 3 - How the agent concludes]

**Output**:
```markdown
[Full example of the agent's response]
```

## Checklist (Optional)

<!-- Pre-completion verification steps -->

Before completing tasks, verify:
- [ ] [Check 1]
- [ ] [Check 2]
- [ ] [Check 3]
- [ ] [Check 4]
- [ ] [Check 5]

## Notes (Optional)

<!-- Additional context that doesn't fit elsewhere -->

[Any additional information, historical context, or miscellaneous notes]
