# Brainstorming Skill (`/bs`)

Meta-skill for coordinating creative brainstorming sessions across multiple agents to explore diverse solutions before implementation.

## Usage
`{/bs [topic or problem description]}`

## Purpose
Facilitate structured brainstorming sessions by:
1. Clarifying the brainstorming goal and context
2. Generating diverse ideas from multiple specialized perspectives
3. Organizing and categorizing ideas thematically
4. Evaluating feasibility and impact for the current tech stack
5. Creating actionable outputs with recommended next steps

---

## Session Structure

### Phase 1: Clarify Goal
- Parse the user's brainstorming request
- Identify the core problem or opportunity
- Determine relevant domains (frontend, backend, calculation, database, architecture)
- Clarify any constraints or requirements

### Phase 2: Generate Ideas
- Encourage wild, creative solutions from each perspective
- Leverage domain expertise from specialist agents
- Explore multiple approaches, not just obvious ones
- Consider both incremental and transformative ideas

### Phase 3: Organize
- Group ideas thematically (UI/UX, Architecture, Features, Process, etc.)
- Identify patterns and connections between ideas
- Highlight particularly innovative or high-impact concepts

### Phase 4: Evaluate
- Assess feasibility for the current tech stack (HTML/JS + Azure Functions)
- Estimate implementation complexity
- Identify potential risks or blockers
- Prioritize based on impact vs effort

### Phase 5: Output
- Generate organized summary of all ideas
- Provide feasibility assessment for each category
- Recommend specific next steps
- Suggest which agent(s) to involve for implementation

---

## Agent Coordination Pattern

This skill **spawns existing agents** from `.claude/agents/` to gather diverse perspectives, then synthesizes the results.

### Relevant Agents by Domain

| Domain | Agent | Expertise |
|--------|-------|-----------|
| UI/UX (Main Calculator) | Frontend Agent | Responsive design, component architecture, interactions |
| UI/UX (Backoffice) | Backoffice Agent | Backoffice admin UI, role management, audit logs |
| API & Data Access | Backend Agent | Azure Functions, endpoints, error handling |
| Authentication & Security | Auth & Security Agent | Dual auth (Azure AD + JWT), rate limiting, security policies |
| Logging & Monitoring | Logging & Monitoring Agent | Application logging, performance tracking, health checks |
| Pricing Logic | Calculation Agent | Formulas, multipliers, commission, business logic |
| Data Structure | Database Agent | Schema, queries, normalization, diagnostic scripts |
| Deployment | Deployment Agent | Azure deployment, CI/CD, configuration |
| System Design | Architect Agent | Cross-layer architecture, technical decisions |
| Implementation Planning | Planner Agent | Task breakdown, dependencies, sequencing |

### Spawning Strategy

**Spawn agents in parallel** based on identified domains:

```
User Request: "{/bs How can we improve mobile material entry?"

Relevant Domains: Frontend + Calculation

Spawn in parallel:
    ├── Frontend Agent → "Generate UI/UX ideas for mobile material entry"
    └── Calculation Agent → "Consider calculation accuracy and real-time updates"

Synthesize results into organized categories
```

**Frontend vs Backoffice example:**

```
User Request: "{/bs Ideas for improving the calculator UI"

Relevant Domain: Frontend (main calculator only)

Spawn:
    └── Frontend Agent → "UI improvements for src/index.html"
```

```
User Request: "{/bs Ideas for improving the backoffice admin UI"

Relevant Domain: Backoffice (backoffice only)

Spawn:
    └── Backoffice Agent → "UI improvements for src/backoffice.html"
```

**Multi-domain example:**

```
User Request: "{/bs Ideas for adding customer quotes and saving them"

Relevant Domains: Frontend + Backend + Database + Architect

Spawn in parallel:
    ├── Frontend Agent → "UI for quote management, export, print"
    ├── Backend Agent → "API endpoints for CRUD operations on quotes"
    ├── Database Agent → "Schema for storing quotes, line items, metadata"
    └── Architect Agent → "Cross-layer design and consistency"

Synthesize and present organized options
```

**Backoffice-specific example:**

```
User Request: "{/bs How can we improve the backoffice role management?"

Relevant Domains: Backoffice + Backend + Auth & Security

Spawn in parallel:
    ├── Backoffice Agent → "UX improvements for role assignment UI"
    ├── Backend Agent → "API endpoints for role CRUD operations"
    └── Auth & Security Agent → "RBAC security considerations"

Synthesize and present organized options
```

**Logging & monitoring example:**

```
User Request: "{/bs Ideas for better performance tracking"

Relevant Domains: Logging & Monitoring + Backend + Database

Spawn in parallel:
    ├── Logging & Monitoring Agent → "Performance metrics and dashboards"
    ├── Backend Agent → "API instrumentation and response tracking"
    └── Database Agent → "Query performance optimization"

Synthesize and present organized options
```

---

## Project Context

### Technology Stack
- **Frontend**: Single-page HTML (`src/index.html`), vanilla JavaScript, Tailwind CSS
- **Backend**: Azure Functions v4, Node.js
- **Database**: SQL Server with connection pooling
- **Deployment**: Azure (serverless)

### Core Features
- Labor calculation (manhours × branch cost × multipliers)
- Materials management (search, add, quantity, cost calculation)
- Sales Profit % (user-editable, can be negative for discounts)
- Travel/Shipping (Km × 15 baht/km rate)
- Commission calculation (tiered based on Sub Grand Total vs Sub Total Cost ratio)
- Mode switching (Executive vs Sales - hides sensitive cost data)

### Existing Patterns
- Responsive design: Mobile cards (< md breakpoint), desktop tables (md+)
- State management: Global variables with reactive updates
- Mode visibility: `isExecutiveMode()` for conditional display
- Fixed positioning: Desktop dropdowns use `fixed z-50`
- Database loading modal: Connection status with spinner
- Editable inputs: Manhours, quantities, Sales Profit %

### Agent Team Hierarchy
```
Orchestrator Agent (Coordinator)
    ├── Architect Agent (Technical Lead)
    └── Planner Agent (Implementation Lead)
        ├── Frontend Agent (UI Specialist - Main Calculator)
        ├── Backoffice Agent (UI Specialist - Backoffice Admin)
        ├── Backend Agent (API Specialist)
        ├── Auth & Security Agent (Authentication & Security)
        ├── Logging & Monitoring Agent (Logging & Performance)
        ├── Calculation Agent (Formula Specialist)
        ├── Database Agent (Data Specialist)
        └── Deployment Agent (Azure Deployment)
```

---

## Output Format

After the brainstorming session, present:

### 1. Idea Summary by Category
Organize ideas into thematic groups:
- **Quick Wins**: Low-effort, high-impact improvements
- **Feature Enhancements**: New capabilities or extensions
- **Architectural Changes**: Structural improvements or refactoring
- **UX/UI Improvements**: Enhanced user experience
- **Process/Workflow**: Better ways of working

### 2. Feasibility Assessment
For each category, assess:
- Technical feasibility (High/Medium/Low)
- Implementation complexity (Simple/Moderate/Complex)
- Potential risks or blockers
- Dependencies on other changes

### 3. Recommended Next Steps
- Which idea(s) to pursue first
- Which agent(s) to involve for implementation
- Suggested implementation order
- Whether to involve Planner Agent for detailed planning

---

## Example Usage Patterns

```
{/bs How can we improve the mobile experience for adding materials?}
{/bs Explore different approaches for implementing a discount feature}
{/bs Ideas for better visual feedback when calculation errors occur}
{/bs How might we add batch editing for materials?}
{/bs Brainstorm ways to add quote history and versioning}
{/bs Ideas for improving performance on large material searches}
{/bs How could we add multi-currency support?}
{/bs Explore options for exporting calculations to PDF}
{/bs Ideas for improving backoffice role assignment workflow}
{/bs How can we add better security to the backoffice login?}
{/bs Brainstorm approaches for comprehensive audit logging}
{/bs Ideas for real-time performance monitoring dashboards}
```

---

## Guidelines

### During Brainstorming
1. **Encourage diversity**: Get perspectives from multiple domains
2. **Think expansively**: Include wild ideas alongside practical ones
3. **Stay relevant**: Keep ideas connected to the Price List Calculator context
4. **Document everything**: Capture all ideas before filtering

### During Synthesis
1. **Organize thoughtfully**: Group by theme, not by agent
2. **Evaluate objectively**: Assess feasibility based on actual tech stack constraints
3. **Prioritize strategically**: Consider impact, effort, and dependencies
4. **Be specific**: Next steps should name specific agents and suggest starting points

### When Recommending Next Steps
1. **Match agent to domain**: Frontend/Backoffice for UI, Backend for API, Auth & Security for authentication, Logging & Monitoring for logging, Calculation for formulas, Database for schema, Deployment for Azure
2. **Simplify first**: Recommend quick wins before complex changes
3. **Consider dependencies**: Some ideas require architectural work first
4. **Invite Planner involvement**: For multi-step implementations, suggest Planner Agent

---

## Skill Behavior Checklist

When user invokes `{/bs [topic]}`:

- [ ] Parse the brainstorming request and clarify the goal
- [ ] Identify relevant domains (frontend, backoffice, backend, auth & security, logging & monitoring, calculation, database, architecture)
- [ ] Spawn appropriate agents in parallel to gather diverse perspectives
- [ ] Collect all ideas from each agent
- [ ] Organize ideas into thematic categories
- [ ] Evaluate feasibility for the tech stack (HTML/JS + Azure Functions + SQL Server)
- [ ] Present organized summary with:
  - [ ] Ideas grouped by category
  - [ ] Feasibility assessment for each category
  - [ ] Recommended next steps with specific agent(s) to involve
