# Agent Team System

This document describes the hierarchical agent team system for coordinating complex tasks across domains in this repository.

## Overview

The agent team system is located in `.claude/agents/` and uses a hierarchical structure:
- **Orchestrator** → Top-level coordinator that receives user requests and delegates to appropriate agents
- **Architect/Planner** → Leadership agents for technical decisions and implementation planning
- **Specialists** → Domain-specific agents for focused tasks

See [`.claude/agents/TEAM.md`](.claude/agents/TEAM.md) for complete coordination protocols.

## Agent Categories

### Translation Agents
- `english-to-chinese-translator.md` (FanYi) - Translates between English and Chinese

### Coordination Agents
- `orchestrator.md` - Top-level coordinator for the Price List Calculator agent team
- `planner.md` - Implementation lead for detailed implementation planning and task breakdown
- `chinese-foreman.md` (工头/Gongtou) - Chinese project foreman agent

### Leadership Agents
- `architect.md` - Technical lead for system architecture and technical decisions

### Domain Specialists
- `frontend.md` - UI components, responsive design, and interactions for the main calculator
- `backoffice.md` - Backoffice admin system UI for user role management and administration
- `backend.md` - API endpoints and business logic for the Price List Calculator
- `auth.md` - Authentication systems, authorization, security policies, and access control
- `database.md` - SQL Server schema, queries, and data integrity
- `calculation.md` - Pricing calculations, commission logic, and cost multipliers
- `deployment.md` - Azure deployment, CI/CD, and configuration
- `logging.md` - Application logging, performance tracking, system monitoring, and diagnostics

### Utility Agents
- `internet-researcher.md` (Scout) - Web research and information gathering
- `Template.md` - Base template for creating new agents

## Skill Template System

The system includes templates for creating new skills and agents:

- `.claude/skills/template/` - Base template for creating new skills
- `.claude/skills/add-agents/` - Template for creating new agents
- `.claude/skills/add-skills/` - Template for creating new skills

## Usage

The agent team system is automatically invoked by Claude Code when working on this repository. Each agent has specific responsibilities and expertise for their domain. The Orchestrator agent coordinates task routing and ensures appropriate agents are involved based on the task complexity and domain.

For more details on how agents coordinate, refer to [`.claude/agents/TEAM.md`](.claude/agents/TEAM.md).
