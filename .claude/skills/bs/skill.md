---
name: bs
description: Coordinate all agents to brainstorm multi-perspective solutions for any command
version: 2.0.0
user-invocable: true
---

# Brainstorm Coordinator Skill (`/bs`)

**Purpose**: Summon ALL agents in `.claude/agents/` to provide multi-perspective insights and solutions for ANY command, regardless of domain or complexity.

## When to Use This Skill

Use this skill when you want:
- **Multiple perspectives** on a problem or decision
- **Cross-domain insights** from all specialist agents
- **Comprehensive analysis** before making changes
- **Creative solutions** that span multiple areas of the codebase
- **Validation** of approaches across all domains
- **"All-hands" input** on any command or question

## Core Responsibilities

1. **Agent Discovery** - Enumerate ALL agents in `.claude/agents/` directory
2. **Parallel Summoning** - Launch ALL agents simultaneously with the user's command
3. **Response Aggregation** - Collect insights from each agent
4. **Synthesis** - Combine perspectives into coherent recommendations
5. **Conflict Resolution** - Highlight where agents disagree and provide resolution guidance

## Brainstorm Process Flow

### 1. Receive User Command
- Accept any command, question, or task from the user
- No filtering by domain or complexity

### 2. Discover All Agents
- Scan `.claude/agents/` directory for all `.md` agent files
- Exclude: `TEAM.md` and `Template.md`
- Build agent list with their roles and specialties

### 3. Summon All Agents in Parallel
- Launch ALL agents simultaneously using the Task tool
- Provide each agent with the full user command
- Request each agent's unique perspective on the command

### 4. Aggregate Responses
- Collect output from each agent as they complete
- Track which agents have responded
- Handle agent errors gracefully (log error, continue aggregation)

### 5. Synthesize and Present
- Organize insights by domain/perspective
- Identify common themes across agents
- Highlight conflicts or disagreements
- Provide consolidated recommendations

## Output Format

### Brainstorm Summary Structure

```markdown
## Brainstorm Session: [User Command]

### Summary
[Brief overview of the brainstorm session]

### Agent Perspectives

#### [Agent Name] ([Domain])
[Agent's insights and recommendations]

#### [Agent Name] ([Domain])
[Agent's insights and recommendations]

[... continue for all agents ...]

### Cross-Cutting Themes
- [Theme 1] - [Which agents mentioned this]
- [Theme 2] - [Which agents mentioned this]

### Conflicts & Resolutions
| Issue | Agent A View | Agent B View | Resolution |
|-------|-------------|-------------|------------|
| [Issue] | [View] | [View] | [Suggested resolution] |

### Consolidated Recommendations
1. [Priority 1 recommendation with rationale]
2. [Priority 2 recommendation with rationale]
3. [Priority 3 recommendation with rationale]

### Next Steps
- [Actionable next steps based on brainstorm]
```

## Example Usage

```
/bs How should we add a new discount feature?
/bs What's the best approach for refactoring the auth system?
/bs Design a comprehensive testing strategy
/bs How can we improve application security across all layers?
/bs Evaluate pros and cons of migrating to TypeScript
/bs What should we prioritize for the next sprint?
/bs How do we implement real-time notifications?
/bs Design approach for adding multi-language support
```

## Example Brainstorm Session

**User Command**: "How should we add a new discount feature?"

**Process**:
1. Discover all agents in `.claude/agents/`
2. Launch ALL agents in parallel with command
3. Architect Agent: Design patterns for discount system
4. Planner Agent: Implementation steps and dependencies
5. Frontend Agent: UI requirements for discount inputs
6. Backend Agent: API endpoints needed
7. Calculation Agent: Formula modifications
8. Database Agent: Schema changes required
9. Auth & Security Agent: Permission considerations
10. [All other agents provide their perspectives]
11. Synthesize all perspectives into consolidated recommendations

## Agent Discovery

The skill automatically discovers all agents in `.claude/agents/`:
1. Scans directory for `*.md` files
2. Excludes `TEAM.md` and `Template.md`
3. Parses each agent's role from file content
4. Builds agent list for parallel summoning

**Known Agents** (as of last update):
- Orchestrator Agent (Coordinator - usually skipped, avoid infinite loop)
- Architect Agent (Technical Lead)
- Planner Agent (Implementation Lead)
- Chinese Foreman Agent (Chinese Coordinator)
- Universal Translator Agent (Translation-only)
- Frontend Agent (Main Calculator UI)
- Backoffice Agent (Backoffice UI)
- Backend Agent (API Endpoints)
- Auth & Security Agent (Authentication & Security)
- Logging & Monitoring Agent (Logging & Performance)
- Calculation Agent (Pricing Formulas)
- Database Agent (SQL Schema & Queries)
- Deployment Agent (Azure Deployment)
- Internet Researcher Agent (Web Research)

## Error Handling

### Agent Launch Failures
- Log error with agent name
- Continue with remaining agents
- Note failure in final summary

### Agent Timeouts
- Set reasonable timeout per agent
- Include partial results in summary
- Note which agents timed out

### Empty Responses
- Note agent provided no input
- Continue aggregation
- Don't fail entire session

## Parallel Execution Strategy

When summoning all agents:
1. Use single message with multiple Task tool calls (parallel execution)
2. Each agent gets identical prompt with user's command
3. Prompt includes agent's role context for relevant perspective
4. Collect all responses before synthesis

## Brainstorm Logging Prefixes

Use these prefixes for clear logging:
- `[BRAINSTORM]` - General brainstorm activity
- `[BRAINSTORM][DISCOVER]` - Agent discovery
- `[BRAINSTORM][SUMMON]` - Agent summoning
- `[BRAINSTORM][AGGREGATE]` - Response collection
- `[BRAINSTORM][SYNTHESIS]` - Perspective synthesis

---

## Agent Team Coordination

The `/bs` skill (Brainstorm Coordinator) is part of a hierarchical agent team with clear coordination protocols. This section provides comprehensive team context for coordinating brainstorm tasks effectively.

### Team Structure

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
│  │  (工头/Gongtou)      │  │ (Scout - research support)   │ │
│  │  Translation +       │  │                              │ │
│  │  Chinese Coordination│  │                              │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │ Universal Translator │  │ Brainstorm Coordinator       │ │
│  │ (WanNengYi/万能译)   │  │ (/bs skill - ALL agents)     │ │
│  │ Multi-language       │  │ Multi-perspective synthesis  │ │
│  │ translation-only     │  │                              │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Agent Hierarchy

#### Level 1: Orchestrator Agent
**Role**: Top-level coordinator
**File**: `.claude/agents/orchestrator.md`
**Responsibilities**:
- Parse user requests and determine scope
- Route tasks to appropriate lead agents
- Coordinate multi-domain tasks
- Track overall progress
- Handle conflicts between agent recommendations

#### Level 2: Lead Agents

**Architect Agent (Technical Lead)**
- **Role**: System architecture and technical decisions
- **File**: `.claude/agents/architect.md`
**Responsibilities**: Design new features, ensure consistency, identify technical debt, make cross-cutting decisions
- **Coordinates**: Frontend, Backoffice, Backend, Auth & Security, Logging & Monitoring, Calculation, Database agents

**Planner Agent (Implementation Lead)**
- **Role**: Implementation planning and task breakdown
- **File**: `.claude/agents/planner.md`
**Responsibilities**: Create implementation plans, break down tasks, define dependencies, identify specialists
- **Coordinates**: All specialist agents based on task requirements

#### Coordination Agents (Level 2)

**Chinese Foreman Agent (工头/Gongtou)**
- **Role**: Translate prompts from any language to Chinese and coordinate Chinese-language agents
- **File**: `.claude/agents/chinese-foreman.md`
**Responsibilities**: Translation, agent discovery, task distribution, result aggregation
- **Use When**: Chinese-language task requires both translation AND multi-agent coordination

#### Level 3: Specialist Agents

| Agent | Role | File | Scope |
|-------|------|------|-------|
| Frontend Agent | UI components, responsive design, interactions | `frontend.md` | Main calculator only (`src/index.html`) |
| Backoffice Agent | Backoffice admin UI, role management | `backoffice.md` | Backoffice only (`src/backoffice.html`) |
| Backend Agent | Azure Functions API, business logic | `backend.md` | API endpoints only |
| Auth & Security Agent | Authentication systems, security policies, RBAC | `auth.md` | Dual auth, rate limiting, security |
| Logging & Monitoring Agent | Application logging, performance tracking | `logging.md` | Logger utility, metrics, archival |
| Calculation Agent | Pricing formulas, commission logic | `calculation.md` | Cost calculations, multipliers |
| Database Agent | SQL schema, queries, data integrity | `database.md` | Schema, queries, migrations |
| Deployment Agent | Azure deployment, CI/CD | `deployment.md` | Azure deployment, configuration |

#### Utility Agents

**Universal Translator Agent (WanNengYi/万能译)**
- **Role**: Multi-language translation agent for [Any Language]→Chinese prompts
- **File**: `.claude/agents/universal-translator.md`
- **Use When**: Only translation is needed (no coordination)
- **Supported Languages**: English, Thai, Japanese, Korean, and more

**Internet Researcher Agent (Scout)**
- **Role**: Research information from internet to support other agents' decisions
- **File**: `.claude/agents/internet-researcher.md`
- **Responsibilities**: Web search, content analysis, best practices research, source citation
- **Supports**: All specialist agents with research needs

**Brainstorm Coordinator Agent (`/bs` skill)**
- **Role**: Summon ALL agents for multi-perspective brainstorming
- **File**: This skill (`.claude/skills/bs/SKILL.md`)
- **Responsibilities**: Agent discovery, parallel summoning, response aggregation, synthesis
- **Use When**: Multiple perspectives needed on ANY command

### Coordination Protocols

#### Protocol: Brainstorm Tasks (`/bs` skill)
```
User invokes `/bs` command
                ↓
    Skill receives user command
                ↓
    Discover ALL agents in `.claude/agents/`
                ↓
    Summon ALL agents in parallel with command
                ↓
    Aggregate perspectives from each agent
                ↓
    Synthesize into consolidated recommendations
                ↓
    Present multi-perspective summary to user
```

**Key Difference**: Unlike normal task routing (which selects ONE agent), `/bs` summons ALL agents regardless of command type.

### Decision Tree for Task Routing

```
Did user invoke `/bs` command?
    YES → Brainstorm Coordinator → Summon ALL agents in parallel
    NO  → Continue

Is the task simple and single-domain?
    YES → Direct to specialist agent
    NO  → Continue

Is it a research task?
    YES → Internet Researcher Agent (Scout)
    NO  → Continue

Is it a Chinese-language task?
    YES → Chinese Foreman Agent
    NO  → Continue

Is it translation only (no coordination)?
    YES → Universal Translator (WanNengYi)
    NO  → Continue

Is it an authentication/security task?
    YES → Auth & Security Agent
    NO  → Continue

Does the task involve architecture/design?
    YES → Architect Agent
    NO  → Continue

Does the task require implementation planning?
    YES → Planner Agent
    NO  → Orchestrator to coordinate
```

**Special Case**: `/bs` bypasses normal routing and forces all-agent coordination.

### When to Involve Each Agent

| Trigger | Agent to Involve |
|---------|-----------------|
| Multi-perspective brainstorm on ANY command | Brainstorm Coordinator (`/bs` skill) |
| Research best practices/patterns | Internet Researcher Agent (Scout) |
| Translate any language to Chinese prompt | Universal Translator (translation only) or Chinese Foreman (translation + coordination) |
| Fix button alignment (main calculator) | Frontend Agent (direct) |
| Fix backoffice UI layout | Backoffice Agent (direct) |
| Add new API endpoint | Backend Agent (direct) |
| Add authentication to endpoint | Auth & Security Agent (direct) |
| Add performance logging | Logging & Monitoring Agent (direct) |
| Add new feature (frontend + backend) | Planner Agent → Frontend + Backend + Auth |
| Major architectural change | Architect Agent → Planner Agent → Specialists |
| Multi-domain refactoring | Architect Agent → Planner Agent → All specialists |
| Performance investigation | Architect Agent → Logging & Monitoring Agent + Research |

### How `/bs` Coordinates with Other Agents

The `/bs` skill (Brainstorm Coordinator) summons ALL agents for any command:

1. **Direct Invocation**: User calls `/bs` directly for any command
2. **Agent Discovery**: Scans `.claude/agents/` for all agent files
3. **Parallel Summoning**: Launches ALL agents simultaneously with user's command
4. **Response Aggregation**: Collects insights from each agent as they complete
5. **Synthesis**: Combines perspectives, identifies themes, resolves conflicts
6. **Presentation**: Delivers consolidated multi-perspective recommendations

### Tools and Permissions

#### Brainstorm Coordinator (`/bs` skill)
- **Tools**: Task tool (for summoning agents), Read tool (for agent discovery)
- **Spawns**: ALL agents in `.claude/agents/` (parallel execution)
- **Access**: Agent files for discovery, user command for propagation

#### Other Agents (for reference)
- **Orchestrator**: All tools, spawns all agents, full access
- **Lead Agents (Architect, Planner)**: All tools, spawn specialists, full access
- **Specialist Agents**: Domain-specific tools, domain-specific file access
- **Coordination Agents**: Task tool, Read tool for agent discovery

### File Structure

```
.claude/agents/
├── TEAM.md                      (Team overview - this reference)
├── orchestrator.md              (Level 1: Coordinator)
├── architect.md                 (Level 2: Technical lead)
├── planner.md                   (Level 2: Implementation lead)
├── chinese-foreman.md           (Level 2: Chinese coordinator)
├── universal-translator.md      (Multi-language translation-only)
├── frontend.md                  (Level 3: Specialist - Main calculator)
├── backoffice.md                (Level 3: Specialist - Backoffice)
├── backend.md                   (Level 3: Specialist - API)
├── auth.md                      (Level 3: Specialist - Auth & security)
├── logging.md                   (Level 3: Specialist - Logging)
├── calculation.md               (Level 3: Specialist - Formulas)
├── database.md                  (Level 3: Specialist - Schema)
├── deployment.md                (Level 3: Specialist - Azure)
├── internet-researcher.md       (Utility: Web research)
└── Template.md                  (Universal template)
```
