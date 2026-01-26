# Agent Team Overview

Hierarchical agent team for the Price List Calculator with clear coordination protocols.

## Team Structure

```
                    ┌─────────────────────┐
                    │  Orchestrator Agent │
                    │   (Coordinator)     │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐           ┌────────▼────────┐
        │ Architect Agent│           │  Planner Agent  │
        │  (Technical)   │           │ (Implementation)│
        └───────┬────────┘           └────────┬────────┘
                │                             │
                └──────────────┬──────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
│ Frontend Agent │   │ Backend Agent   │   │Database Agent   │
│  (Specialist)  │   │  (Specialist)   │   │  (Specialist)   │
└────────────────┘   └─────────────────┘   └─────────────────┘

        ┌──────────────────────┐
        │  Calculation Agent   │
        │    (Specialist)      │
        └──────────────────────┘

        ┌──────────────────────┐
        │  Deployment Agent    │
        │    (Specialist)      │
        └──────────────────────┘
```

## Agent Hierarchy

### Level 1: Orchestrator Agent
**Role**: Top-level coordinator
**File**: `.claude/agents/orchestrator.md`
**Responsibilities**:
- Parse user requests and determine scope
- Route tasks to appropriate lead agents
- Coordinate multi-domain tasks
- Track overall progress
- Handle conflicts between agent recommendations

### Level 2: Lead Agents

#### Architect Agent (Technical Lead)
**Role**: System architecture and technical decisions
**File**: `.claude/agents/architect.md`
**Responsibilities**:
- Design new features with consideration for all layers
- Ensure consistency with existing patterns
- Identify technical debt and suggest refactoring
- Make decisions on cross-cutting concerns
**Coordinates**: Frontend, Backend, Database, Calculation agents

#### Planner Agent (Implementation Lead)
**Role**: Implementation planning and task breakdown
**File**: `.claude/agents/planner.md`
**Responsibilities**:
- Create step-by-step implementation plans
- Break down complex tasks into subtasks
- Define task dependencies and sequence
- Identify which specialist agents are needed
- Create verification/testing steps
**Coordinates**: All specialist agents based on task requirements

### Level 3: Specialist Agents

| Agent | Role | File | Reports To |
|-------|------|------|------------|
| Frontend Agent | UI components, responsive design, interactions | `frontend.md` | Architect (UI/UX), Planner (implementation) |
| Backend Agent | Azure Functions API, database operations | `backend.md` | Architect (API), Planner (implementation) |
| Calculation Agent | Pricing formulas, commission logic, multipliers | `calculation.md` | Architect (formulas), Planner (implementation) |
| Database Agent | SQL schema, queries, data integrity | `database.md` | Architect (schema), Planner (migrations) |
| Deployment Agent | Azure deployment, CI/CD, configuration | `deploy.md` | Architect (infrastructure), Planner (releases) |

## Coordination Protocols

### Protocol 1: Task Routing
```
User Request → Orchestrator Agent
                ↓
    Analyze scope and domain
                ↓
    ┌───────────┴───────────┐
    │                       │
Single-domain        Multi-domain
    │                       │
Direct to          Create coordination
specialist          plan, involve Planner
```

### Protocol 2: Escalation
```
Specialist Agent discovers issue beyond scope
                ↓
    Escalate to Lead Agent (Architect/Planner)
                ↓
    Lead Agent coordinates with other specialists
                ↓
    Lead Agent reports back to Orchestrator
                ↓
    Orchestrator updates user
```

### Protocol 3: Conflict Resolution
```
Multiple agents provide conflicting recommendations
                ↓
    Architect Agent makes technical decision
                ↓
    Orchestrator Agent communicates decision
                ↓
    All specialist agents implement per decision
```

### Protocol 4: Handoff
```
Agent completes assigned subtask
                ↓
    Report to orchestrating agent (Planner or Orchestrator)
                ↓
    Orchestrating agent validates completion
                ↓
    Next subtask assigned to appropriate agent
```

## Quick Reference

### Decision Tree for Task Routing
```
Is the task simple and single-domain?
    YES → Direct to specialist agent
    NO  → Continue

Does the task involve architecture/design?
    YES → Architect Agent
    NO  → Continue

Does the task require implementation planning?
    YES → Planner Agent
    NO  → Orchestrator to coordinate
```

### When to Involve Each Agent

| Trigger | Agent to Involve |
|---------|-----------------|
| Fix button alignment | Frontend Agent (direct) |
| Add new API endpoint | Backend Agent (direct) |
| Update commission formula | Calculation Agent (direct) |
| Optimize SQL query | Database Agent (direct) |
| Fix deployment issue | Deployment Agent (direct) |
| Add new feature (frontend only) | Planner Agent → Frontend Agent |
| Add new feature (frontend + backend) | Planner Agent → Frontend + Backend |
| Major architectural change | Architect Agent → Planner Agent → Specialists |
| Database schema modification | Architect Agent + Database Agent → Planner Agent |
| Multi-domain refactoring | Architect Agent → Planner Agent → All specialists |

## File Structure

```
.claude/agents/
├── TEAM.md              (This file - team overview)
├── orchestrator.md      (Level 1: Coordinator)
├── architect.md         (Level 2: Technical lead)
├── planner.md           (Level 2: Implementation lead)
├── frontend.md          (Level 3: Specialist)
├── backend.md           (Level 3: Specialist)
├── calculation.md       (Level 3: Specialist)
├── database.md          (Level 3: Specialist)
└── deployment.md        (Level 3: Specialist)
```

## Tools and Permissions

### Orchestrator Agent
- **Tools**: All tools (coordination requires full visibility)
- **Spawns**: Architect, Planner, Specialist agents
- **Access**: All files and operations

### Lead Agents (Architect, Planner)
- **Tools**: All tools (leadership requires full visibility)
- **Spawns**: Specialist agents
- **Access**: All files and operations

### Specialist Agents
- **Tools**: Task-specified tools for their domain
- **Access**: Files relevant to their specialization
- **Spawns**: None (escalate to lead agents)

## Verification Tests

After implementation, verify the team works correctly:

### Test 1: Simple Single-Domain Task
```
User: "Fix the mobile layout for the materials table"
Expected: Orchestrator routes directly to Frontend Agent
```

### Test 2: Multi-Domain Task
```
User: "Add a new discount feature"
Expected: Orchestrator involves Planner Agent, who coordinates specialists
```

### Test 3: Architectural Change
```
User: "Add a new user authentication system"
Expected: Orchestrator involves Architect Agent for design, then Planner for implementation
```

### Test 4: Escalation Protocol
```
Specialist: "This change requires database schema modification"
Expected: Specialist escalates to Architect + Database Agent, then Planner for implementation
```

### Test 5: Conflict Resolution
```
Frontend Agent: "Use modal dialog"
Backend Agent: "Use inline form"
Expected: Architect Agent makes decision, Orchestrator communicates it
```
