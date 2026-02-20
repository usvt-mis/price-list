---
name: bs
description: Coordinate brainstorming sessions across specialist agents to explore diverse solutions before implementation
version: 1.0.0
user-invocable: true
---

# Brainstorming Skill (`/bs`)

Meta-skill for coordinating creative brainstorming sessions across multiple specialist agents to explore diverse solutions before implementation.

## 使用场景 (When to Use)

Use this skill when:
- You need to explore multiple approaches before implementing a feature
- You want diverse perspectives from domain specialists
- You're unsure which architecture or design pattern to choose
- You need creative solutions for complex problems
- You want to evaluate feasibility before committing to implementation

## 核心原则 (Core Principles)

1. **Encourage diversity** - Get perspectives from multiple specialized domains
2. **Think expansively** - Include wild ideas alongside practical ones
3. **Stay relevant** - Keep ideas connected to Price List Calculator context
4. **Document everything** - Capture all ideas before filtering
5. **Evaluate objectively** - Assess based on current tech stack constraints

## 执行步骤 (Execution Steps)

### Phase 1: Clarify Goal
- Parse user's brainstorming request
- Identify core problem or opportunity
- Determine relevant domains (frontend, backoffice, backend, calculation, database, architecture)
- Clarify any constraints or requirements

### Phase 2: Generate Ideas
- Spawn relevant specialist agents in parallel
- Encourage wild, creative solutions from each perspective
- Leverage domain expertise from specialist agents
- Explore multiple approaches, not just obvious ones
- Consider both incremental and transformative ideas

### Phase 3: Organize
- Group ideas thematically (UI/UX, Architecture, Features, Process, etc.)
- Identify patterns and connections between ideas
- Highlight particularly innovative or high-impact concepts

### Phase 4: Evaluate
- Assess feasibility for current tech stack
- Estimate implementation complexity
- Identify potential risks or blockers
- Prioritize based on impact vs effort

### Phase 5: Output
- Generate organized summary of all ideas
- Provide feasibility assessment for each category
- Recommend specific next steps
- Suggest which agent(s) to involve for implementation

## 项目上下文 (Project Context)

### Technology Stack
- **Frontend**: Single-page HTML (`src/index.html`), vanilla JavaScript, Tailwind CSS
- **Backoffice**: Standalone HTML (`src/backoffice.html`) with 3-tab role management
- **Backend**: Express.js (primary), Azure Functions v4 (legacy)
- **Database**: Azure SQL Server with connection pooling
- **Deployment**: Azure App Service (serverless)

### Core Features
- Labor calculation (manhours × branch cost × multipliers)
- Materials management (search, add, quantity, cost calculation)
- Sales Profit % (user-editable, can be negative for discounts)
- Travel/Shipping (Km × 15 baht/km rate)
- Commission calculation (tiered based on Sub Grand Total vs Sub Total Cost ratio)
- Mode switching (Executive vs Sales - hides sensitive cost data)
- Saved calculations with sharing capabilities
- Role-based access control (Executive, Sales, NoRole, Customer)
- Backoffice admin for role management

### Specialist Agent Team

| Agent | Expertise | Relevant For |
|-------|-----------|--------------|
| Orchestrator | Task routing, conflict resolution, progress tracking | All multi-domain sessions |
| Architect | Cross-layer architecture, technical decisions | System design, refactoring |
| Frontend | Main Calculator UI, responsive design, interactions | `src/index.html` changes |
| Backoffice | Backoffice admin UI, role management, audit logs | `src/backoffice.html` changes |
| Backend | API endpoints, error handling, middleware | `api/src/routes/` changes |
| Auth & Security | Dual auth (Azure AD + JWT), RBAC, security policies | Authentication, authorization |
| Logging & Monitoring | Application logging, performance tracking, health checks | Diagnostics, monitoring |
| Calculation | Pricing formulas, multipliers, commission, business logic | Cost calculation changes |
| Database | Schema, queries, normalization, diagnostic scripts | SQL, tables, migrations |
| Deployment | Azure deployment, CI/CD, configuration | Deployment, infrastructure |
| Planner | Task breakdown, dependencies, sequencing | Implementation planning |

## Agent Coordination Pattern

This skill **spawns existing agents** from `.claude/agents/` to gather diverse perspectives, then synthesizes the results.

### Spawning Strategy

**Spawn agents in parallel** based on identified domains:

```
User Request: "/bs How can we improve mobile material entry?"

Relevant Domains: Frontend + Calculation

Spawn in parallel:
    ├── Frontend Agent → "Generate UI/UX ideas for mobile material entry"
    └── Calculation Agent → "Consider calculation accuracy and real-time updates"

Synthesize results into organized categories
```

**Multi-domain example:**

```
User Request: "/bs Ideas for adding customer quotes and saving them"

Relevant Domains: Frontend + Backend + Database + Architect

Spawn in parallel:
    ├── Frontend Agent → "UI for quote management, export, print"
    ├── Backend Agent → "API endpoints for CRUD operations on quotes"
    ├── Database Agent → "Schema for storing quotes, line items, metadata"
    └── Architect Agent → "Cross-layer design and consistency"

Synthesize and present organized options
```

## 输出格式 (Output Format)

After brainstorming session, present:

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

## 示例用法 (Example Usage)

```
/bs How can we improve mobile material entry?
/bs Explore different approaches for implementing a discount feature
/bs Ideas for better visual feedback when calculation errors occur
/bs How might we add batch editing for materials?
/bs Explore options for exporting calculations to PDF
/bs Ideas for improving backoffice role assignment workflow
/bs How could we add quote history and versioning?
/bs Brainstorm ways to add multi-currency support?
/bs Ideas for improving performance on large material searches
/bs How can we add better security to backoffice login?
/bs Brainstorm approaches for comprehensive audit logging
/bs Ideas for real-time performance monitoring dashboards
```

## 检查清单 (Checklist)

When user invokes `/bs [topic]`:

- [ ] Parse brainstorming request and clarify goal
- [ ] Identify relevant domains (frontend, backoffice, backend, auth & security, logging & monitoring, calculation, database, architecture)
- [ ] Spawn appropriate agents in parallel to gather diverse perspectives
- [ ] Collect all ideas from each agent
- [ ] Organize ideas into thematic categories
- [ ] Evaluate feasibility for current tech stack (HTML/JS + Express.js + SQL Server)
- [ ] Present organized summary with:
  - [ ] Ideas grouped by category
  - [ ] Feasibility assessment for each category
  - [ ] Recommended next steps with specific agent(s) to involve
- [ ] Suggest whether Planner Agent should be involved for detailed implementation planning

## 注意事项 (Best Practices)

### During Brainstorming
1. Spawn multiple agents when domains overlap
2. Let each agent explore their domain fully
3. Don't filter ideas too early - capture everything first
4. Consider the Price List Calculator's existing patterns and constraints

### During Synthesis
1. Organize by theme, not by agent
2. Be honest about technical limitations
3. Prioritize quick wins alongside ambitious ideas
4. Always provide specific next steps

### When Recommending Next Steps
1. Match agent to domain (Frontend/Backoffice for UI, Backend for API, etc.)
2. Recommend simple solutions before complex ones
3. Consider dependencies between ideas
4. Suggest Planner Agent involvement for multi-step implementations
