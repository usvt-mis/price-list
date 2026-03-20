# Custom Skills

This document describes the custom slash commands (skills) available in this repository for automating workflows.

## Overview

Custom skills are located in `.claude/skills/` and provide specialized automation capabilities for common development tasks.

## Available Skills

### `/update` Skill
Automatically updates project documentation based on code changes and creates a git commit with a conventional commit message.

**Usage:**
```
/update
```

**What it does:**
- Analyzes recent code changes
- Updates relevant documentation files
- Creates a git commit with an appropriate conventional commit message
- Follows commit message conventions from the project's git history

### `/bs` Skill
Coordinates brainstorming sessions across multiple agents to generate multi-perspective solutions.

**Usage:**
```
/bs [topic or command]
```

**What it does:**
- Spawns multiple specialist agents concurrently
- Gathers diverse perspectives on the given topic
- Synthesizes insights from different domains
- Provides comprehensive solutions that consider multiple viewpoints

### `/deploy` Skill
Deploys the application to Azure App Service Production environment.

**Usage:**
```
/deploy
```

**What it does:**
- Coordinates with the Deployment agent
- Handles Azure deployment procedures
- Manages CI/CD processes
- Ensures proper configuration for production environment

### `/fix` Skill
Professionally diagnose and fix issues in the application with systematic analysis and proper resolution.

**Usage:**
```
/fix [issue description or error details]
```

**What it does:**
- Analyzes the issue and understands the root cause
- Locates relevant code and understands context
- Implements a minimal, targeted fix
- Tests the fix (if applicable)
- Creates a proper commit with conventional commit message

### `/start` Skill
Start the Express.js application locally for development.

**Usage:**
```
/start
```

**What it does:**
- Runs pre-start checks (Node.js, API configuration)
- Starts the Express.js server on port 8080
- Monitors startup progress
- Reports local development URL and any errors

## Skill Templates

The repository includes templates for creating new skills:

- `template/` - Base template for creating new skills
- `add-agents/` - Template for creating new agents
- `add-skills/` - Template for creating new skills

## Creating New Skills

To create a new skill:

1. Use the `/add-skills` slash command
2. Provide the skill name, description, and structure
3. The skill will be created from the standardized template
4. Customize the skill logic for your specific use case

## Skill Development

Skills are defined as markdown files with frontmatter containing:
- **name**: The slash command name
- **description**: What the skill does
- **triggers**: When to use the skill (optional)

For examples, refer to the existing skill files in `.claude/skills/`.
