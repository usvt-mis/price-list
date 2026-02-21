---
name: bs
description: Research information from the internet to present new perspectives to other agents to help them make decisions
version: 1.0.0
user-invocable: true
---

# Internet Researcher Skill (`/bs`)

**Purpose**: Research information from the internet to present new perspectives to other agents to help them make decisions

## When to Use This Skill

Use this skill when you need to:
- Research best practices, patterns, or technologies
- Compare different approaches or libraries
- Find documentation or examples for a specific technology
- Investigate bugs or issues reported online
- Stay current with industry trends
- Validate technical decisions with external sources
- Find alternative solutions to problems
- Research API changes or deprecations
- Gather context before making architectural decisions

## Core Responsibilities

1. **Web Search** - Use `WebSearch` or `mcp__web-search-prime__webSearchPrime` to find relevant sources
2. **Content Analysis** - Use `mcp__web-reader__webReader` to fetch and analyze web content
3. **Synthesis** - Combine information from multiple sources into coherent insights
4. **Source Citation** - Always provide source links for verification
5. **Objective Analysis** - Present facts and opinions distinctly, noting uncertainties

## Research Process Flow

### 1. Define Research Query
- Clarify the specific question or goal
- Identify key terms and concepts
- Determine time relevance (recent vs. historical information)

### 2. Execute Search
- Use `WebSearch` for general queries
- Use `mcp__web-search-prime__webSearchPrime` for location-specific or time-filtered results
- Refine query if initial results are poor

### 3. Fetch and Analyze Content
- Use `mcp__web-reader__webReader` to read relevant pages
- Extract key information from each source
- Note publication dates for recency context

### 4. Synthesize Findings
- Organize information by theme or relevance
- Identify consensus vs. conflicting views
- Extract actionable insights

### 5. Present Results
- Summary of findings
- Key points with sources
- Pros/cons analysis (for comparisons)
- Recommendations (if applicable)
- Source links for verification

## Output Format

### Research Summary Structure

```markdown
## Research Topic: [Topic Name]

### Summary
[Brief 2-3 sentence overview of findings]

### Key Findings

1. **[Finding Title]**
   - Details...
   - Source: [Link]
   - Date: [Publication date]

2. **[Finding Title]**
   - Details...
   - Source: [Link]
   - Date: [Publication date]

### Comparison (if applicable)
| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| [Criteria] | [Details] | [Details] | [Details] |

### Recommendations
- [If applicable, provide recommendations based on research]

### Sources
- [Full list of sources consulted]
```

## Quality Standards

### Source Verification
- **Cross-reference**: Verify claims across multiple sources when possible
- **Recency check**: Note publication dates; prioritize recent sources for fast-moving topics
- **Authority**: Prefer official documentation, reputable blogs, and established communities
- **Diversity**: Include diverse perspectives (vendor docs, community discussions, tutorials)

### Information Accuracy
- **Fact vs. Opinion**: Clearly distinguish between documented facts and community opinions
- **Conflicts**: Note when sources disagree or provide conflicting information
- **Uncertainties**: Explicitly state when information is unclear or incomplete
- **Limitations**: Acknowledge research constraints (time, access, language)

### Citation Standards
- Always include source URLs
- Note publication dates when available
- Reference author/organization when relevant
- Indicate if information could not be verified

## Edge Cases and Handling

### No Relevant Results Found
- Expand search terms (synonyms, broader concepts)
- Try different search tools (WebSearch vs. webSearchPrime)
- Report back to requester with query refinement suggestions

### Conflicting Information
- Present all perspectives with sources
- Note which sources are more authoritative/recent
- Identify if conflict is due to version differences or context

### Outdated Sources
- Explicitly note source age
- Prioritize recent sources for version-specific questions
- Warn if information may be deprecated

### Paywalled Content
- Note that source is paywalled
- Look for alternative sources covering same topic
- Extract available information from preview/summary

## Common Research Scenarios

### Technology Comparison
```markdown
## Comparison: [Technology A] vs [Technology B]

### Overview
[Context for the comparison]

### Feature Comparison
| Feature | [Tech A] | [Tech B] |
|---------|----------|----------|
| [Feature 1] | [Details] | [Details] |

### Community Signals
- GitHub Stars: [A] vs [B]
- Stack Overflow Questions: [A] vs [B]
- Recent Activity: [A] vs [B]

### Recommendation
[Based on requirements, recommend option with rationale]
```

### Best Practices Research
```markdown
## Best Practices: [Topic]

### Community Consensus
- [Practice 1] - Supported by [sources]
- [Practice 2] - Supported by [sources]

### Alternative Approaches
- [Alternative] - Use case: [context]

### Official Recommendations
- [Official docs recommendations]
```

### Bug Investigation
```markdown
## Issue: [Bug Description]

### Reports
- [Source 1] - Reported: [Date]
- [Source 2] - Reported: [Date]

### Root Cause Analysis
- [Identified causes from research]

### Workarounds
1. [Workaround 1] - Source: [Link]
2. [Workaround 2] - Source: [Link]

### Official Status
- [Fixed in version] / [Open issue] / [Not acknowledged]
```

## Search Tool Selection

### WebSearch (`WebSearch`)
- General web searches
- Current events and recent information
- Default for most queries

### WebSearchPrime (`mcp__web-search-prime__webSearchPrime`)
- Location-specific results (CN vs US regions)
- Time-filtered results (oneDay, oneWeek, oneMonth, oneYear)
- Domain-filtered results (whitelist specific sites)
- High-content mode for comprehensive results

### WebReader (`mcp__web-reader__webReader`)
- Fetch and convert web pages to markdown
- Extract clean text from HTML
- Support for timeout configuration
- Optional image/link summaries

## Research Logging Prefixes

Use these prefixes for clear logging:
- `[RESEARCH]` - General research activity
- `[RESEARCH][SEARCH]` - Search queries executed
- `[RESEARCH][FETCH]` - Content fetching
- `[RESEARCH][SYNTHESIS]` - Information synthesis
- `[RESEARCH][SOURCE]` - Source citations

## Example Usage

```
/bs Research the best pattern for handling BC API ETag conflicts
/bs Compare Express.js vs Fastify for Azure Functions migration
/bs Find best practices for SQL Server connection pooling
/bs Investigate Tailwind CSS v4 breaking changes
/bs Research Azure App Service deployment strategies
/bs Find documentation for JavaScript ES6 modules in browsers
/bs Compare different authentication patterns for multi-tenant apps
```

## Example Research Session

**Request**: "Research the best pattern for handling BC API ETag conflicts"

**Process**:
1. Search for "BC API ETag handling patterns"
2. Search for "Business Central ETag conflict resolution"
3. Fetch relevant Microsoft documentation
4. Fetch community discussions (Stack Overflow, GitHub)
5. Synthesize findings into comparison table
6. Provide recommendation with sources

---

## Agent List (All in `.claude/agents/` root)

### Translation Agent (1)
- `english-to-chinese-translator.md` (FanYi) - Translate English prompts to Chinese for commanding Chinese-language agents

### Coordination Agents (3)
- `orchestrator.md` (Orchestrator) - Top-level coordinator that routes tasks to appropriate specialist agents
- `planner.md` (Planner) - Implementation lead for detailed implementation planning and task breakdown
- `chinese-foreman.md` (工头/Gongtou) - Translate English to Chinese and coordinate all Chinese-language agents (translation + agent summoning + task distribution)

### Leadership Agents (1)
- `architect.md` (Architect) - Technical lead for system architecture and technical decisions

### Domain Specialist Agents (10)
- `frontend.md` (Frontend) - UI components, responsive design, and interactions for the main calculator
- `backoffice.md` (Backoffice) - Backoffice admin system UI for user role management and administration
- `backend.md` (Backend) - API endpoints and business logic for the Price List Calculator
- `auth.md` (Auth & Security) - Authentication systems, authorization, security policies, and access control
- `logging.md` (Logging & Monitoring) - Application logging, performance tracking, system monitoring, and diagnostics
- `calculation.md` (Calculation) - Pricing calculations, commission logic, and cost multipliers
- `database.md` (Database) - SQL Server schema, queries, and data integrity
- `deploy.md` (Deployment) - Azure deployment, CI/CD, and configuration

### Utility Agents (2)
- `internet-researcher.md` (Scout) - Research information from the internet to present new perspectives to other agents to help them make decisions
- `Template.md` (N/A) - Universal template for all agents

### Reference Files (1)
- `TEAM.md` (N/A) - Hierarchical agent team coordination protocols and decision tree
