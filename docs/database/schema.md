# Database Schema Reference

Complete reference for the Price List Calculator database schema.

---

## Core Tables

### MotorTypes
Stores motor type classifications for labor calculations.

### Branches
Branch locations with cost multipliers:
- `CostPerHour` - Workshop calculator hourly rate (URY=429, USB=431, USR=331, UKK=359, UPB=403, UCB=518)
- `OnsiteCostPerHour` - Onsite calculator hourly rate (URY=485, USB=554, UPB=479, UCB=872)
- `OverheadPercent` - Overhead multiplier (applied silently)
- `PolicyProfit` - Policy profit multiplier (applied silently)

### Jobs
Available labor jobs with manhours:
- `CalculatorType` - Filters jobs by calculator type ('onsite', 'workshop', 'shared')
- `ManHours` - Base manhours for the job
- `SortOrder` - Display order in UI

### Jobs2MotorType
Junction table linking jobs to motor types:
- `CalculatorType` - Filters assignments by calculator type

### Materials
Material catalog for pricing:
- `MaterialCode`, `MaterialName`, `UnitCost`

---

## Onsite Saved Calculations

### OnsiteSavedCalculations
Header table for onsite saved records:
- Run number format: `ONS-YYYY-XXX` (e.g., ONS-2024-001)
- Onsite-specific columns: `Scope`, `PriorityLevel`, `SiteAccess`
- Onsite Options: `OnsiteCraneEnabled`, `OnsiteCranePrice`, `OnsiteFourPeopleEnabled`, `OnsiteFourPeoplePrice`, `OnsiteSafetyEnabled`, `OnsiteSafetyPrice`

### OnsiteSavedCalculationJobs
Job line items for onsite records (linked via RunNumber)

### OnsiteSavedCalculationMaterials
Material line items for onsite records (linked via RunNumber)
- `OverrideFinalPrice` - Optional manual override for the material's final price (bypasses all multipliers)

---

## Workshop Saved Calculations

### WorkshopSavedCalculations
Header table for workshop saved records:
- Run number format: `WKS-YYYY-XXX` (e.g., WKS-2024-001)
- Workshop-specific columns: `EquipmentUsed`, `MachineHours`, `PickupDeliveryOption`, `QualityCheckRequired`
- `ServiceType` - Service type selection ('Overhaul' or 'Rewind', default: 'Overhaul')
  - Controls which jobs are automatically checked based on service type
  - Overhaul: Checks jobs with "overhaul" in name, unchecks "rewind motor" jobs
  - Rewind: Checks jobs with "rewind" in name, unchecks "overhaul" jobs
  - Migration: `database/migrations/add_service_type_workshop.sql`

### WorkshopSavedCalculationJobs
Job line items for workshop records (linked via RunNumber)

### WorkshopSavedCalculationMaterials
Material line items for workshop records (linked via RunNumber)
- `OverrideFinalPrice` - Optional manual override for the material's final price (bypasses all multipliers)

---

## Legacy Tables

### SavedCalculations
Original unified saved calculations table (kept for rollback)

### SavedCalculationJobs
Original job line items table (kept for rollback)

### SavedCalculationMaterials
Original material line items table (kept for rollback)

### RunNumberSequence
Original run number sequence table (kept for rollback)

### BackofficeAdmins
Backoffice authentication table (deprecated - no longer used for auth; kept for potential rollback)

---

## Role Management Tables

### UserRoles
Stores role assignments for Azure AD users:

| Column | Description |
|--------|-------------|
| Email (PK) | User's email address |
| Role | Executive, Sales, Customer, or NULL (NoRole) |
| AssignedBy | Email of admin who assigned the role |
| AssignedAt | Timestamp of role assignment |
| FirstLoginAt | Tracks when user first logged in |
| LastLoginAt | Updated on every login for activity tracking |

### RoleAssignmentAudit
Audit trail for all role changes:
- Tracks all role assignments, removals, and changes
- Includes `ChangedBy` email for accountability
- Full history with timestamps

---

## Deletion Audit Tables

### OnsiteCalculationDeletionAudit
Permanent audit trail for onsite calculation deletions:

| Column | Description |
|--------|-------------|
| Id (PK) | Auto-incrementing identifier |
| SaveId | ID of the deleted record |
| RunNumber | Run number of the deleted record |
| CreatorEmail | Email of user who created the record |
| BranchId | Branch associated with the record |
| GrandTotal | Final total before deletion |
| DeletedBy | Email of user who performed the deletion |
| DeletedAt | UTC timestamp of deletion |
| ClientIP | IP address of deletion request (for accountability) |
| UserAgent | Browser/client identifier (optional) |
| DeletionReason | Optional reason for deletion |
| Scope | Onsite scope value at deletion time |
| PriorityLevel | Priority level at deletion time |
| SiteAccess | Site access value at deletion time |
| CreatedAt | When the original record was created |

### WorkshopCalculationDeletionAudit
Permanent audit trail for workshop calculation deletions:

| Column | Description |
|--------|-------------|
| Id (PK) | Auto-incrementing identifier |
| SaveId | ID of the deleted record |
| RunNumber | Run number of the deleted record |
| CreatorEmail | Email of user who created the record |
| BranchId | Branch associated with the record |
| GrandTotal | Final total before deletion |
| DeletedBy | Email of user who performed the deletion |
| DeletedAt | UTC timestamp of deletion |
| ClientIP | IP address of deletion request (for accountability) |
| UserAgent | Browser/client identifier (optional) |
| DeletionReason | Optional reason for deletion |
| EquipmentUsed | Equipment used at deletion time |
| PickupDeliveryOption | Pickup/delivery option at deletion time |
| CreatedAt | When the original record was created |

**Indexes:**
- `SaveId` - Quick lookup by record ID
- `DeletedAt (DESC)` - Chronological queries for recent deletions
- `CreatorEmail` - Track deletions by record creator
- `DeletedBy` - Track deletions by deleter

---

## Migration Scripts

### Phase 1 Backoffice (3-tab support)
- `database/migrations/phase1_backoffice_3tabs.sql` - Adds FirstLoginAt/LastLoginAt columns and role index

### Two-Factor Auth (Deprecated)
- `database/migrations/two_factor_auth.sql` - Creates BackofficeAdmins table (deprecated - no longer used for authentication)

### Logging Migration
- `database/migrations/remove_database_logging.sql` - Removes legacy database logging tables after Application Insights migration

### Calculator Tables Split
- `database/migrations/split_calculator_tables.sql` - Splits SavedCalculations into OnsiteSavedCalculations and WorkshopSavedCalculations

### Onsite-to-Workshop Migration (Rollback Available)
- `database/migrations/migrate_onsite_to_workshop.sql` - Migrates all Onsite records to Workshop with new WKS- run numbers
- `database/migrations/rollback_onsite_to_workshop.sql` - Rolls back the onsite-to-workshop migration

### ShareToken Fix
- `database/migrations/fix_sharetoken_unique_constraint.sql` - Replaces inline UNIQUE constraint with filtered index allowing multiple NULLs

### Stored Procedures Fix
- `database/migrations/fix_stored_procedures_error_handling.sql` - Adds TRY/CATCH error handling and fixes SUBSTRING bug in run number generation

### Legacy Calculator Type Migrations
- `database/migrations/calculator_types.sql` - Adds CalculatorType and type-specific columns to SavedCalculations
- `database/migrations/add_scope_column.sql` - Adds Scope dropdown for onsite calculations
- `database/migrations/priority_site_access.sql` - Adds SiteAccess column
- `database/migrations/remove_onsite_location_fields.sql` - Removes CustomerLocation and SiteAccessNotes columns

### Jobs and Branches
- `database/migrations/separate_onsite_workshop_jobs.sql` - Adds CalculatorType column to Jobs and Jobs2MotorType for separate job lists
- `database/migrations/add_onsite_cost_per_hour.sql` - Adds OnsiteCostPerHour column to Branches table for calculator-specific rates

### Materials Override Final Price
- `database/migrations/add_override_final_price.sql` - Adds OverrideFinalPrice column to OnsiteSavedCalculationMaterials and WorkshopSavedCalculationMaterials tables for manual price overrides
- `database/migrations/run-override-final-price-migration.js` - Node.js runner for the OverrideFinalPrice migration

### Deletion Audit Logging
- `database/migrations/add_deletion_audit_tables.sql` - Creates OnsiteCalculationDeletionAudit and WorkshopCalculationDeletionAudit tables for permanent deletion history
- `database/migrations/update_delete_stored_procedures_for_audit.sql` - Updates DeleteOnsiteSavedCalculation and DeleteWorkshopSavedCalculation stored procedures to insert audit entries before soft delete
- `database/diagnose_deletion_audit.sql` - Diagnostic script to verify audit tables, stored procedures, and sample entries

### Email Domain Migration
- `database/migrations/email_domain_migration.sql` - One-off domain rewrite for all text-like user-table values, including preflight inventory, collision checks, backups, transactional update, and post-check validation
- `docs/database/email-domain-migration.md` - Runbook for staging and production execution of the email domain migration

### UTC Migration
- `database/migrations/migrate_to_utc.sql` - Idempotent migration script to convert existing timestamps from local time to UTC

---

## Connection Pooling Notes

- Connection pool is singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection
- When using transactions with stored procedures, ensure stored procedures don't create nested transactions
- Backend handlers manage the outer transaction via `pool.transaction()`

---

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Project overview
- [docs/backend/api-endpoints.md](../backend/api-endpoints.md) - API reference
- [docs/diagnostics/scripts.md](../diagnostics/scripts.md) - Diagnostic scripts
