# Fix Skill (`/fix`)

Professionally diagnose and fix issues in the application with systematic analysis and proper resolution.

## Usage
`{/fix [issue description or error details]}`

## Purpose
Fix issues professionally by:
1. Analyzing the issue and understanding the root cause
2. Locating the relevant code and understanding context
3. Implementing a minimal, targeted fix
4. Testing the fix (if applicable)
5. Creating a proper commit with conventional commit message

---

## Session Structure

### Phase 1: Understand the Issue
- Parse the user's issue description
- Identify the affected component (frontend, backend, database, calculation)
- Determine if an error message or stack trace is provided
- Check for related symptoms or side effects

### Phase 2: Locate and Analyze
- Search for relevant code files using Glob/Grep
- Read affected files to understand the context
- Identify the root cause of the issue
- Consider potential side effects of changes

### Phase 3: Plan the Fix
- Design a minimal, targeted fix
- Consider edge cases and potential issues
- Ensure the fix aligns with existing patterns
- Avoid over-engineering or unnecessary refactoring

### Phase 4: Implement the Fix
- Apply the fix using Edit tool (prefer editing existing files)
- Follow existing code style and patterns
- Add comments only if the logic isn't self-evident
- Ensure no new security vulnerabilities are introduced

### Phase 5: Verify and Commit
- Verify the fix addresses the issue
- Run applicable tests (if any)
- Stage the fix files
- Create a conventional commit with `fix:` prefix
- Include Co-Authored-By tag

---

## Project Context

### Technology Stack
- **Frontend**: Single-page HTML (`src/index.html`, `src/backoffice.html`), vanilla JavaScript, Tailwind CSS
- **Backend**: Azure Functions v4, Node.js
- **Database**: SQL Server with connection pooling
- **Authentication**: Azure AD (main app), username/password JWT (backoffice)

### Common Issue Categories

| Category | Common Issues | Typical Files |
|----------|---------------|---------------|
| **Calculation** | Incorrect formulas, missing multipliers, rounding errors | `src/index.html` (calculation functions) |
| **UI/UX** | Display issues, broken responsive design, missing elements | `src/index.html`, `src/backoffice.html` |
| **API** | Endpoint errors, incorrect responses, authentication failures | `api/src/functions/` |
| **Database** | Connection issues, query errors, missing data | `api/src/db.js`, `database/` |
| **Authentication** | Login failures, role detection issues | `api/src/middleware/` |
| **Performance** | Slow queries, memory leaks, inefficient code | `api/src/utils/`, SQL queries |

### Fix Principles
1. **Minimal changes**: Fix only what's broken
2. **Preserve patterns**: Follow existing code style
3. **No side effects**: Don't introduce new issues
4. **Security first**: Avoid XSS, SQL injection, etc.
5. **Test locally**: Verify before committing

---

## Output Format

After fixing, present:

### 1. Issue Analysis
- **Issue**: Summary of the problem
- **Root Cause**: What was causing the issue
- **Affected Files**: Files that were examined and modified

### 2. Fix Description
- **What was changed**: Brief description of the fix
- **Why it works**: Explanation of how the fix resolves the issue

### 3. Files Modified
List of files changed with line references

### 4. Commit Details
```
fix: <concise description of the fix>

Co-Authored-By: Claude <noreply@anthropic.com>
```
Commit SHA: (hash from git commit)

---

## Example Usage Patterns

```
{/fix Labor calculation is showing zero cost}
{/fix Material search returns no results}
{/fix Backoffice login fails with invalid credentials}
{/fix Commission calculation uses wrong formula}
{/fix Mobile view shows table instead of cards}
{/fix API returns 500 error on /api/branches}
{/fix Role detection not working for new users}
{/fix Database connection timeout error}
{/fix Sales Profit percentage not applying correctly}
{/fix JWT token expires immediately after login}
```

---

## Guidelines

### During Analysis
1. **Read before writing**: Always read affected files before making changes
2. **Understand context**: Grasp how the code fits into the larger system
3. **Find root cause**: Don't just treat symptoms
4. **Check patterns**: Ensure fix aligns with existing patterns

### During Implementation
1. **Edit existing files**: Prefer Edit tool over creating new files
2. **Be minimal**: Fix only what's broken, nothing more
3. **Follow style**: Match existing indentation, naming, patterns
4. **Add comments sparingly**: Only if logic isn't self-evident

### During Verification
1. **Check side effects**: Ensure nothing else is broken
2. **Consider edge cases**: Think about unusual inputs or states
3. **Test locally**: If possible, verify the fix works

### During Commit
1. **Use conventional commits**: Always use `fix:` prefix
2. **Write clear descriptions**: Describe what was fixed and why
3. **Include co-author**: Always add `Co-Authored-By: Claude <noreply@anthropic.com>`

---

## Skill Behavior Checklist

When user invokes `{/fix [issue]}`:

- [ ] Parse and understand the issue description
- [ ] Identify affected component (frontend/backend/database)
- [ ] Search for relevant code using Glob/Grep
- [ ] Read affected files to understand context
- [ ] Identify root cause of the issue
- [ ] Plan a minimal, targeted fix
- [ ] Apply fix using Edit tool (prefer editing existing files)
- [ ] Verify the fix addresses the issue
- [ ] Consider potential side effects
- [ ] Stage modified files
- [ ] Generate conventional commit with `fix:` prefix
- [ ] Include Co-Authored-By tag
- [ ] Create git commit
- [ ] Report analysis, fix details, and commit SHA
