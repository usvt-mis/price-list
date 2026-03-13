# BranchId Migration Guide

## Problem
Users are getting "No Branch assigned" error even though they have branch values in the database. This happens when:
1. The `BranchId` column in `UserRoles` table is NULL
2. There might be an old `BRANCH` column with text values (URY, USB, etc.) that needs to be migrated

## Diagnosis
Run the diagnostic endpoint to check current user status:
```
GET /api/adm/diagnostics/me
```

This will show:
- The user's auth header info
- The user's UserRoles record (including BranchId)
- All available branches

## Solution

### Option 1: Migrate from BRANCH column to BranchId
If you have an old `BRANCH` column with text values (URY, USB, etc.):

```bash
# Connect to Azure SQL
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 \
  -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30 \
  -i api/src/database/schemas/migrate_branch_to_branchid.sql
```

This script will:
1. Check if BRANCH column exists
2. Map text values (URY→1, USB→2, etc.) to BranchId
3. Update the UserRoles table

### Option 2: Manually assign branches via Backoffice
For individual users, use the Backoffice admin panel:
1. Login to backoffice (requires Executive role)
2. Go to Users list
3. Click "Edit" on a user
4. Select Branch from dropdown
5. Save

### Option 3: Direct SQL assignment
Assign BranchId to specific users:

```sql
-- Assign BranchId = 1 (URY) to a user
UPDATE UserRoles
SET BranchId = 1
WHERE Email = 'user@example.com';

-- Assign multiple users at once
UPDATE UserRoles
SET BranchId = 2  -- USB
WHERE Email IN ('user1@example.com', 'user2@example.com');
```

## Verification
After migration, verify that users have BranchId values:

```sql
SELECT Email, Role, BranchId,
  CASE BranchId
    WHEN 1 THEN 'URY'
    WHEN 2 THEN 'USB'
    WHEN 3 THEN 'USR'
    WHEN 4 THEN 'UKK'
    WHEN 5 THEN 'UPB'
    WHEN 6 THEN 'UCB'
    ELSE 'Unassigned'
  END AS BranchCode
FROM UserRoles
ORDER BY Email;
```

## Branch ID Mapping
| BranchId | BranchCode | BranchName  |
|----------|------------|-------------|
| 1        | URY        | URY Service |
| 2        | USB        | USB Service |
| 3        | USR        | USR Service |
| 4        | UKK        | UKK Service |
| 5        | UPB        | UPB Service |
| 6        | UCB        | UCB Service |
