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
    ┌──────────────────────────┼──────────────────────────┐
    │          │               │              │            │
┌───▼────┐ ┌───▼────┐   ┌──────▼──────┐  ┌───▼────┐  ┌───▼────┐
│Frontend│ │Backoff │   │   Backend   │  │ Auth   │  │Logging │
│        │ │office  │   │             │  │& Secur│  │& Monit │
└────────┘ └────────┘   └─────────────┘  └────────┘  └────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Calculation  │  │  Database    │  │  Deployment  │
│              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────────────────────────────────────────────────────┐
│            Coordination + Utility Agents                      │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  Chinese Foreman     │  │ Internet Researcher          │ │
│  │  (工头/Gongtou)      │  │ (Scout)                      │ │
│  │  Translation +       │  │ Research support for all     │ │
│  │  Chinese Coordination│  │ agents                       │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│  ┌──────────────────────┐                                   │
│  │ English To Chinese   │                                   │
│  │ Translator (FanYi)   │                                   │
│  │ Translation-only     │                                   │
│  └──────────────────────┘                                   │
└──────────────────────────────────────────────────────────────┘
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
- Make decisions on cross-cutting concerns (security, performance, scalability)
**Coordinates**: Frontend, Backoffice, Backend, Auth & Security, Logging & Monitoring, Calculation, Database agents

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

### Coordination Agents (Level 2)

#### Chinese Foreman Agent (工头/Gongtou)
**Role**: Translate English to Chinese and coordinate Chinese-language agents
**File**: `.claude/agents/chinese-foreman.md`
**Responsibilities**:
- Translate English prompts to natural Chinese
- Agent discovery and capability matching
- Task distribution to Chinese-language specialists
- Result aggregation and synthesis
**Coordinates**: All Chinese-language specialist agents
**Use When**: Chinese-language task requires both translation AND multi-agent coordination

### Level 3: Specialist Agents

| Agent | Role | File | Scope | Reports To |
|-------|------|------|-------|------------|
| Frontend Agent | UI components, responsive design, interactions | `frontend.md` | Main calculator only (`src/index.html`) | Architect (UI/UX), Planner (implementation) |
| Backoffice Agent | Backoffice admin UI, role management, audit logs | `backoffice.md` | Backoffice only (`src/backoffice.html`) | Architect (UI/UX), Planner (implementation) |
| Backend Agent | Azure Functions API, business logic | `backend.md` | API endpoints only (no auth/logging) | Architect (API), Planner (implementation) |
| Auth & Security Agent | Authentication systems, security policies, RBAC | `auth.md` | Dual auth (Azure AD + JWT), rate limiting, security | Architect (security), Planner (implementation) |
| Logging & Monitoring Agent | Application logging, performance tracking, health checks | `logging.md` | Logger utility, performance metrics, archival | Architect (monitoring), Planner (implementation) |
| Calculation Agent | Pricing formulas, commission logic, multipliers | `calculation.md` | Cost calculations, commission logic, multipliers | Architect (formulas), Planner (implementation) |
| Database Agent | SQL schema, queries, data integrity, diagnostic scripts | `database.md` | Schema, queries, migrations, diagnostics | Architect (schema), Planner (migrations) |
| Deployment Agent | Azure deployment, CI/CD, configuration | `deployment.md` | Azure deployment, CI/CD, configuration | Architect (infrastructure), Planner (releases) |
| **Internet Researcher Agent** | **Web research, best practices, documentation** | **`internet-researcher.md`** | **Research-only, supports all specialists** | **Orchestrator (coordination)** |

### Utility Agents

#### English To Chinese Translator Agent (FanYi)
**Role**: Translation-only agent for English→Chinese prompts
**File**: `.claude/agents/english-to-chinese-translator.md`
**Responsibilities**:
- Prompt translation with context preservation
- Technical terminology handling
- Bilingual output formatting
**Use When**: Only translation is needed (no coordination)
**Related**: Chinese Foreman Agent (for translation + coordination)

#### Internet Researcher Agent (Scout)
**Role**: Research information from internet to support other agents' decisions
**File**: `.claude/agents/internet-researcher.md`
**Responsibilities**:
- Web search and content analysis
- Best practices research
- Technology comparisons
- Source citation and synthesis
**Supports**: All specialist agents with research needs
**Use When**: Research task requiring web search, documentation, or external validation

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

### Protocol 5: Authentication-Related Tasks
```
Auth/Security Task Identified
                ↓
    Orchestrator routes to Auth & Security Agent
                ↓
    If backend changes needed → Coordinate with Backend Agent
    If UI changes needed → Coordinate with Frontend/Backoffice Agent
    If logging needed → Coordinate with Logging & Monitoring Agent
                ↓
    Auth & Security Agent implements with coordination
                ↓
    Verification: Test with all user roles (Executive, Sales, NoRole, Customer)
```

### Protocol 6: Logging/Monitoring Tasks
```
Logging/Monitoring Task Identified
                ↓
    Orchestrator routes to Logging & Monitoring Agent
                ↓
    If backend instrumentation needed → Coordinate with Backend Agent
    If auth events to log → Coordinate with Auth & Security Agent
    If database queries needed → Coordinate with Database Agent
                ↓
    Logging & Monitoring Agent implements with coordination
                ↓
    Verification: Test log queries, performance tracking, health checks
```

### Protocol 7: Backoffice-Specific Tasks
```
Backoffice Task Identified
                ↓
    Orchestrator routes to Backoffice Agent
                ↓
    If API endpoints needed → Coordinate with Backend Agent
    If auth changes needed → Coordinate with Auth & Security Agent
    If audit logging needed → Coordinate with Logging & Monitoring Agent
                ↓
    Backoffice Agent implements with coordination
                ↓
    Verification: Test backoffice functionality independently
```

### Protocol 8: Chinese-Language Tasks
```
Chinese-Language Task Identified
                ↓
    Orchestrator routes to Chinese Foreman Agent
                ↓
    Chinese Foreman translates to Chinese
                ↓
    Agent discovery and task distribution
                ↓
    Result aggregation and synthesis
                ↓
    Chinese Foreman presents unified response
```

### Protocol 9: Research Tasks
```
Research Task Identified
                ↓
    Orchestrator routes to Internet Researcher Agent (Scout)
                ↓
    Scout performs web search and content analysis
                ↓
    Scout synthesizes findings with sources
                ↓
    Scout presents research to requesting agent
                ↓
    Requesting agent uses research for decision/implementation
```

## Quick Reference

### Decision Tree for Task Routing
```
Is the task simple and single-domain?
    YES → Direct to specialist agent
    NO  → Continue

Is it a Chinese-language task?
    YES → Chinese Foreman Agent (translation + coordination)
    NO  → Continue

Is it translation only (no coordination)?
    YES → English To Chinese Translator (FanYi)
    NO  → Continue

Is it a research task?
    YES → Internet Researcher Agent (Scout)
    NO  → Continue

Is it an authentication/security task?
    YES → Auth & Security Agent (may coordinate with others)
    NO  → Continue

Is it a logging/monitoring task?
    YES → Logging & Monitoring Agent (may coordinate with others)
    NO  → Continue

Is it a backoffice-specific task?
    YES → Backoffice Agent (may coordinate with others)
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
| Fix button alignment (main calculator) | Frontend Agent (direct) |
| Fix backoffice UI layout | Backoffice Agent (direct) |
| Add new API endpoint | Backend Agent (direct) |
| Update commission formula | Calculation Agent (direct) |
| Optimize SQL query | Database Agent (direct) |
| Fix deployment issue | Deployment Agent (direct) |
| Add authentication to endpoint | Auth & Security Agent (direct) |
| Add performance logging | Logging & Monitoring Agent (direct) |
| Research best practices/patterns | Internet Researcher Agent (Scout) |
| Translate English to Chinese prompt | English To Chinese Translator (translation only) or Chinese Foreman (translation + coordination) |
| Coordinate multi-agent Chinese workflow | Chinese Foreman Agent (工头) |
| Add new feature (main calculator UI only) | Planner Agent → Frontend Agent |
| Add new feature (backoffice UI only) | Planner Agent → Backoffice Agent |
| Add new feature (frontend + backend) | Planner Agent → Frontend + Backend + Auth |
| Change authentication policy | Planner Agent → Auth & Security + Frontend + Backend |
| Add logging to endpoint | Planner Agent → Logging & Monitoring + Backend |
| Major architectural change | Architect Agent → Planner Agent → Specialists |
| Database schema modification | Architect Agent + Database Agent → Planner Agent |
| Multi-domain refactoring | Architect Agent → Planner Agent → All specialists |
| Security audit | Architect Agent → Auth & Security Agent |
| Performance investigation | Architect Agent → Logging & Monitoring Agent |

## File Structure

```
.claude/agents/
├── TEAM.md                      (This file - team overview)
├── orchestrator.md              (Level 1: Coordinator)
├── architect.md                 (Level 2: Technical lead)
├── planner.md                   (Level 2: Implementation lead)
├── chinese-foreman.md           (Level 2: Chinese-language coordinator + translator)
├── english-to-chinese-translator.md  (Translation-only agent)
├── frontend.md                  (Level 3: Specialist - Main calculator)
├── backoffice.md                (Level 3: Specialist - Backoffice admin)
├── backend.md                   (Level 3: Specialist - API endpoints)
├── auth.md                      (Level 3: Specialist - Authentication & security)
├── logging.md                   (Level 3: Specialist - Logging & monitoring)
├── calculation.md               (Level 3: Specialist - Formulas)
├── database.md                  (Level 3: Specialist - Schema & queries)
├── deployment.md                (Level 3: Specialist - Azure deployment)
├── internet-researcher.md       (Utility: Web research)
└── Template.md                  (Universal template for new agents)
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

### Coordination Agents (Chinese Foreman)
- **Tools**: Task tool (launching agents), Read tool (reading agent files)
- **Spawns**: Chinese-language specialist agents
- **Access**: Agent files for capability discovery

### Specialist Agents
- **Tools**: Task-specified tools for their domain
- **Access**: Files relevant to their specialization
- **Spawns**: None (escalate to lead agents)

### Utility Agents
- **Tools**: WebSearch, WebSearchPrime, WebReader (research tools only)
- **Spawns**: None (research-only, escalates findings)
- **Access**: External web sources, project docs for context

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

### Test 4: Authentication Task
```
User: "Add rate limiting to backoffice login"
Expected: Orchestrator routes to Auth & Security Agent, may coordinate with Backoffice Agent
```

### Test 5: Logging Task
```
User: "Add performance tracking to all API endpoints"
Expected: Orchestrator routes to Logging & Monitoring Agent, coordinates with Backend Agent
```

### Test 6: Backoffice Task
```
User: "Add user search to backoffice admin"
Expected: Orchestrator routes to Backoffice Agent, may coordinate with Backend Agent
```

### Test 7: Escalation Protocol
```
Specialist: "This change requires database schema modification"
Expected: Specialist escalates to Architect + Database Agent, then Planner for implementation
```

### Test 8: Conflict Resolution
```
Frontend Agent: "Use modal dialog"
Backend Agent: "Use inline form"
Expected: Architect Agent makes decision, Orchestrator communicates it
```

### Test 9: Scope Boundary Test
```
User: "Update backoffice login page"
Expected: Orchestrator routes to Backoffice Agent (NOT Frontend Agent)
```

### Test 10: Cross-Domain Coordination
```
User: "Add audit logging for role changes"
Expected: Planner Agent coordinates Auth & Security (role changes), Logging & Monitoring (audit), Backoffice (UI)
```

### Test 11: Chinese-Language Task
```
User: "在中文界面添加新功能" (Add new feature to Chinese interface)
Expected: Orchestrator routes to Chinese Foreman Agent for translation and coordination
```

### Test 12: Translation-Only Task
```
User: "Translate 'Fix the calculator layout' to Chinese"
Expected: English To Chinese Translator (FanYi) provides translation without coordination
```

### Test 13: Research Task
```
User: "Research best practices for SQL Server connection pooling"
Expected: Orchestrator routes to Internet Researcher Agent (Scout)
```
