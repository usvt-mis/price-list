# Update Documentation and Commit Skill (`/update`)

Automatically updates project documentation based on code changes and creates a git commit with conventional commit message.

## Usage
`{/update [optional commit message]}`

## Purpose
Streamline the documentation and commit workflow by:
1. Analyzing code changes to understand impact
2. Automatically updating CLAUDE.md and README.md
3. Staging all related changes
4. Generating conventional commit message
5. Creating git commit with co-author tag

---

## Session Structure

### Phase 1: Analyze Changes
- Run `git status` to detect modified/untracked files
- Run `git diff` to analyze actual changes
- Categorize changes by type:
  - **Feature additions** (new functionality) → `feat:`
  - **Bug fixes** (corrections to existing behavior) → `fix:`
  - **Refactoring** (code structure changes without behavior change) → `refactor:`
  - **Documentation** (docs-only changes) → `docs:`
  - **Chore** (maintenance, config, dependencies) → `chore:`
  - **Tool/Infrastructure** (sqlcmd, CLI tools, connection config) → `tool:`
  - **Database schema** (migrations, schema changes) → `schema:`
- Identify affected documentation sections
- Determine commit type

### Phase 2: Update Documentation
Based on the analyzed changes, update documentation:

**CLAUDE.md updates:**
- New features → Add to appropriate sections (Frontend Data Flow, Key Implementation Details)
- Formula changes → Update calculation sections
- UI/UX changes → Update relevant UX sections
- New API endpoints → Add to Backend Structure → HTTP handlers list
- New patterns → Add to appropriate sections (under Key Implementation Details)
- Architectural changes → Update Architecture section
- New skills/agents → Note in CLAUDE.md if relevant
- **sqlcmd/database tools** → Add to Database Connection Pooling section or Quick Start
- **Database scripts** → Update Database Diagnostics section with new script info
- **Schema changes** → Update Database Schema section

**README.md updates:**
- User-facing features → Update feature list in Overview
- Setup changes → Update installation/setup instructions
- Deployment changes → Update deployment section
- New API endpoints → Update API Endpoints table

**Maintenance guidelines:**
- Read current documentation before making changes
- Maintain existing style, tone, and structure
- Be specific - update only relevant sections
- Don't rewrite entire docs unless necessary

### Phase 3: Stage Files
- Stage documentation changes: `git add CLAUDE.md README.md`
- Stage code changes related to the update (identified in Phase 1)
- Stage `.claude/` files if present

### Phase 4: Generate Commit Message
- If user provided a message: use it as the description
- Otherwise: auto-generate conventional commit based on diff analysis
- Format: `<type>: <concise description>`
- Add Co-Authored-By tag: `Co-Authored-By: Claude <noreply@anthropic.com>`

**Type determination logic:**
- If only docs changed → `docs:`
- If new user-facing feature → `feat:`
- If bug fix → `fix:`
- If code restructuring → `refactor:`
- If dependencies/config → `chore:`
- If sqlcmd/CLI tool changes → `tool:`
- If database schema changes (`.sql` files in `database/`) → `schema:`

### Phase 5: Create Commit
- Execute `git commit` with generated message using heredoc format
- Report commit SHA and summary

---

## Project Context

### Documentation Files

**CLAUDE.md** (Primary technical documentation):
- Project Overview
- Architecture (Database Schema, Backend Structure, Frontend Structure)
- Development Commands
- Key Implementation Details (detailed sections for each feature)
- Adding New API Endpoints

**README.md** (User-facing documentation):
- Overview
- Architecture (high-level)
- UI Features
- Database Schema (table-level)
- API Endpoints
- Development (setup, running locally)
- Project Structure
- Deployment

### Technology Stack
- **Frontend**: Single-page HTML (`src/index.html`), vanilla JavaScript, Tailwind CSS
- **Backend**: Azure Functions v4, Node.js
- **Database**: SQL Server with connection pooling
- **Direct DB Access**: sqlcmd for diagnostics and troubleshooting
- **Deployment**: Azure (serverless)

### Common Change Scenarios

| Change Type | Documentation Update |
|-------------|---------------------|
| New API endpoint | CLAUDE.md: Add to HTTP handlers list<br>README.md: Add to API Endpoints table |
| New UI feature | CLAUDE.md: Add to appropriate section (Frontend Data Flow or specific UX section)<br>README.md: Add to UI Features if user-facing |
| Formula change | CLAUDE.md: Update relevant calculation section |
| New pattern | CLAUDE.md: Add to Key Implementation Details |
| Config change | README.md: Update Development or Deployment sections |
| New skill/agent | CLAUDE.md: Note in relevant section (if applicable) |
| **sqlcmd/DB tool** | CLAUDE.md: Add to Database Connection Pooling section<br>README.md: Update Development section with sqlcmd examples |
| **Database script** | CLAUDE.md: Update Database Diagnostics section<br>README.md: Note in troubleshooting section if applicable |
| **Schema change** | CLAUDE.md: Update Database Schema section |

---

## Output Format

After completing, present:

### 1. Analysis Summary
What changes were detected:
- Modified files: (list from git status)
- Change categories: (feat/fix/refactor/docs/chore)
- Affected documentation sections

### 2. Documentation Updates
What was updated:
- **CLAUDE.md**: (sections updated)
- **README.md**: (sections updated)
- (Or "No documentation updates needed" if applicable)

### 3. Staged Files
List of files committed

### 4. Commit Details
```
<commit message>

Co-Authored-By: Claude <noreply@anthropic.com>
```
Commit SHA: (hash from git commit)

---

## Example Usage Patterns

```
{/update}
{/update add new material search feature}
{/update fix labor calculation overflow}
{/update refactor database connection pooling}
{/update docs: update API endpoint documentation}
{/update tool: add sqlcmd connection info to database agent}
{/update schema: add backoffice sessions table}
```

---

## Guidelines

### During Analysis
1. **Check git status first**: Identify all modified/untracked files
2. **Read git diff carefully**: Understand what actually changed
3. **Categorize accurately**: Use conventional commit types correctly
4. **Consider impact**: Determine which documentation sections are affected

### During Documentation Updates
1. **Read before writing**: Always read existing docs before updating
2. **Maintain consistency**: Match existing style, tone, and structure
3. **Be specific**: Update only relevant sections, don't rewrite entire docs
4. **Preserve formatting**: Keep existing markdown structure and headers

### During Commit Creation
1. **Use conventional commits**: feat/fix/docs/chore/refactor prefixes
2. **Write clear descriptions**: Concisely describe what changed and why
3. **Include co-author**: Always add `Co-Authored-By: Claude <noreply@anthropic.com>`
4. **Skip empty commits**: Don't create commits if no actual changes exist

### When User Provides Message
1. **Use as description**: Treat user's message as the commit description
2. **Determine type**: Still analyze changes to determine commit type (feat/fix/etc)
3. **Add co-author**: Always include the Co-Authored-By tag

---

## Skill Behavior Checklist

When user invokes `{/update [message]}`:

- [ ] Run `git status` to detect modified/untracked files
- [ ] Run `git diff` to analyze actual changes
- [ ] Categorize changes (feat/fix/refactor/docs/chore/tool/schema)
- [ ] Check for `.sql` files in `database/` directory (schema changes)
- [ ] Check for sqlcmd or database tool changes (tool changes)
- [ ] Identify affected documentation sections
- [ ] Read CLAUDE.md and README.md
- [ ] Update CLAUDE.md if architecture/features/patterns/tools changed
- [ ] Update README.md if user-facing features/setup changed
- [ ] Stage documentation files (`git add CLAUDE.md README.md`)
- [ ] Stage related code changes
- [ ] Generate or use provided commit message
- [ ] Include Co-Authored-By tag
- [ ] Create git commit
- [ ] Report commit SHA and summary with analysis
