-- ================================================================
-- Diagnostic Script: Deletion Audit Tables
-- Purpose: Verify audit tables, stored procedures, and sample data
--
-- Usage: Run this script after applying the deletion audit migrations
-- to verify everything is set up correctly.
-- ================================================================

SET NOCOUNT ON;
GO

PRINT '';
PRINT '====================================================';
PRINT 'Deletion Audit Diagnostic';
PRINT '====================================================';
PRINT '';

-- ================================================================
-- 1. Check if audit tables exist
-- ================================================================

PRINT '1. Checking audit tables...';
PRINT '';

DECLARE @OnsiteAuditTable BIT = 0;
DECLARE @WorkshopAuditTable BIT = 0;

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'OnsiteCalculationDeletionAudit')
BEGIN
    SET @OnsiteAuditTable = 1;
    PRINT '  [OK] OnsiteCalculationDeletionAudit table exists';
END
ELSE
BEGIN
    PRINT '  [MISSING] OnsiteCalculationDeletionAudit table NOT found';
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkshopCalculationDeletionAudit')
BEGIN
    SET @WorkshopAuditTable = 1;
    PRINT '  [OK] WorkshopCalculationDeletionAudit table exists';
END
ELSE
BEGIN
    PRINT '  [MISSING] WorkshopCalculationDeletionAudit table NOT found';
END

PRINT '';

-- ================================================================
-- 2. Check indexes on audit tables
-- ================================================================

PRINT '2. Checking audit table indexes...';
PRINT '';

IF @OnsiteAuditTable = 1
BEGIN
    DECLARE @OnsiteIndexCount INT;

    SELECT @OnsiteIndexCount = COUNT(*)
    FROM sys.indexes i
    INNER JOIN sys.tables t ON i.object_id = t.object_id
    WHERE t.name = 'OnsiteCalculationDeletionAudit'
      AND i.name IS NOT NULL
      AND i.is_primary_key = 0;

    IF @OnsiteIndexCount >= 4
    BEGIN
        PRINT '  [OK] OnsiteCalculationDeletionAudit has indexes ('
            + CAST(@OnsiteIndexCount AS NVARCHAR(10)) + ' found)';

        -- List indexes
        SELECT
            '  -> ' COLLATE database_default + i.name + ' (' COLLATE database_default + i.type_desc + ')' COLLATE database_default AS IndexName
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = 'OnsiteCalculationDeletionAudit'
          AND i.name IS NOT NULL
          AND i.is_primary_key = 0
        ORDER BY i.name;
    END
    ELSE
    BEGIN
        PRINT '  [WARN] OnsiteCalculationDeletionAudit missing indexes (expected 4, found '
            + CAST(@OnsiteIndexCount AS NVARCHAR(10)) + ')';
    END
END

IF @WorkshopAuditTable = 1
BEGIN
    DECLARE @WorkshopIndexCount INT;

    SELECT @WorkshopIndexCount = COUNT(*)
    FROM sys.indexes i
    INNER JOIN sys.tables t ON i.object_id = t.object_id
    WHERE t.name = 'WorkshopCalculationDeletionAudit'
      AND i.name IS NOT NULL
      AND i.is_primary_key = 0;

    IF @WorkshopIndexCount >= 4
    BEGIN
        PRINT '  [OK] WorkshopCalculationDeletionAudit has indexes ('
            + CAST(@WorkshopIndexCount AS NVARCHAR(10)) + ' found)';

        -- List indexes
        SELECT
            '  -> ' COLLATE database_default + i.name + ' (' COLLATE database_default + i.type_desc + ')' COLLATE database_default AS IndexName
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = 'WorkshopCalculationDeletionAudit'
          AND i.name IS NOT NULL
          AND i.is_primary_key = 0
        ORDER BY i.name;
    END
    ELSE
    BEGIN
        PRINT '  [WARN] WorkshopCalculationDeletionAudit missing indexes (expected 4, found '
            + CAST(@WorkshopIndexCount AS NVARCHAR(10)) + ')';
    END
END

PRINT '';

-- ================================================================
-- 3. Check stored procedures
-- ================================================================

PRINT '3. Checking stored procedures...';
PRINT '';

DECLARE @OnsiteProc BIT = 0;
DECLARE @WorkshopProc BIT = 0;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteOnsiteSavedCalculation')
BEGIN
    SET @OnsiteProc = 1;
    PRINT '  [OK] DeleteOnsiteSavedCalculation procedure exists';

    -- Check SET options
    DECLARE @AnsiNulls BIT = OBJECTPROPERTY(OBJECT_ID('DeleteOnsiteSavedCalculation'), 'ExecIsAnsiNullsOn');
    DECLARE @QuotedId BIT = OBJECTPROPERTY(OBJECT_ID('DeleteOnsiteSavedCalculation'), 'ExecIsQuotedIdentOn');

    IF @AnsiNulls = 1 AND @QuotedId = 1
        PRINT '  [OK] Procedure has correct SET options (ANSI_NULLS=ON, QUOTED_IDENTIFIER=ON)';
    ELSE
        PRINT '  [WARN] Procedure has incorrect SET options';
END
ELSE
BEGIN
    PRINT '  [MISSING] DeleteOnsiteSavedCalculation procedure NOT found';
END

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteWorkshopSavedCalculation')
BEGIN
    SET @WorkshopProc = 1;
    PRINT '  [OK] DeleteWorkshopSavedCalculation procedure exists';

    -- Check SET options
    DECLARE @AnsiNullsW BIT = OBJECTPROPERTY(OBJECT_ID('DeleteWorkshopSavedCalculation'), 'ExecIsAnsiNullsOn');
    DECLARE @QuotedIdW BIT = OBJECTPROPERTY(OBJECT_ID('DeleteWorkshopSavedCalculation'), 'ExecIsQuotedIdentOn');

    IF @AnsiNullsW = 1 AND @QuotedIdW = 1
        PRINT '  [OK] Procedure has correct SET options (ANSI_NULLS=ON, QUOTED_IDENTIFIER=ON)';
    ELSE
        PRINT '  [WARN] Procedure has incorrect SET options';
END
ELSE
BEGIN
    PRINT '  [MISSING] DeleteWorkshopSavedCalculation procedure NOT found';
END

PRINT '';

-- ================================================================
-- 4. Check stored procedure parameters
-- ================================================================

PRINT '4. Checking stored procedure parameters...';
PRINT '';

IF @OnsiteProc = 1
BEGIN
    DECLARE @OnsiteParamCount INT;

    SELECT @OnsiteParamCount = COUNT(*)
    FROM sys.parameters
    WHERE object_id = OBJECT_ID('DeleteOnsiteSavedCalculation');

    IF @OnsiteParamCount = 5
    BEGIN
        PRINT '  [OK] DeleteOnsiteSavedCalculation has 5 parameters (updated)';

        -- List parameters
        SELECT
            '  -> @' COLLATE database_default + pp.name + ' ' COLLATE database_default + TYPE_NAME(pp.user_type_id) +
            CASE WHEN pp.max_length = -1 THEN '(MAX)' COLLATE database_default
                 WHEN TYPE_NAME(pp.user_type_id) IN ('nvarchar', 'varchar', 'char', 'nchar')
                 THEN '(' COLLATE database_default + CAST(pp.max_length / 2 AS NVARCHAR(10)) + ')' COLLATE database_default
                 ELSE '' COLLATE database_default
            END COLLATE database_default AS ParameterName
        FROM sys.parameters pp
        WHERE pp.object_id = OBJECT_ID('DeleteOnsiteSavedCalculation')
        ORDER BY pp.parameter_id;
    END
    ELSE
    BEGIN
        PRINT '  [WARN] DeleteOnsiteSavedCalculation has '
            + CAST(@OnsiteParamCount AS NVARCHAR(10)) + ' parameters (expected 5)';
    END
END

IF @WorkshopProc = 1
BEGIN
    DECLARE @WorkshopParamCount INT;

    SELECT @WorkshopParamCount = COUNT(*)
    FROM sys.parameters
    WHERE object_id = OBJECT_ID('DeleteWorkshopSavedCalculation');

    IF @WorkshopParamCount = 5
    BEGIN
        PRINT '  [OK] DeleteWorkshopSavedCalculation has 5 parameters (updated)';

        -- List parameters
        SELECT
            '  -> @' COLLATE database_default + pp.name + ' ' COLLATE database_default + TYPE_NAME(pp.user_type_id) +
            CASE WHEN pp.max_length = -1 THEN '(MAX)' COLLATE database_default
                 WHEN TYPE_NAME(pp.user_type_id) IN ('nvarchar', 'varchar', 'char', 'nchar')
                 THEN '(' COLLATE database_default + CAST(pp.max_length / 2 AS NVARCHAR(10)) + ')' COLLATE database_default
                 ELSE '' COLLATE database_default
            END COLLATE database_default AS ParameterName
        FROM sys.parameters pp
        WHERE pp.object_id = OBJECT_ID('DeleteWorkshopSavedCalculation')
        ORDER BY pp.parameter_id;
    END
    ELSE
    BEGIN
        PRINT '  [WARN] DeleteWorkshopSavedCalculation has '
            + CAST(@WorkshopParamCount AS NVARCHAR(10)) + ' parameters (expected 5)';
    END
END

PRINT '';

-- ================================================================
-- 5. Sample audit entries
-- ================================================================

PRINT '5. Sample audit entries...';
PRINT '';

DECLARE @OnsiteAuditCount INT;
DECLARE @WorkshopAuditCount INT;

IF @OnsiteAuditTable = 1
BEGIN
    SELECT @OnsiteAuditCount = COUNT(*) FROM OnsiteCalculationDeletionAudit;

    IF @OnsiteAuditCount > 0
    BEGIN
        PRINT '  OnsiteCalculationDeletionAudit: ' + CAST(@OnsiteAuditCount AS NVARCHAR(10)) + ' entries';

        -- Show recent entries
        SELECT TOP 5
            DeletedAt,
            RunNumber,
            CreatorEmail,
            DeletedBy,
            ClientIP,
            DeletionReason,
            GrandTotal
        FROM OnsiteCalculationDeletionAudit
        ORDER BY DeletedAt DESC;
    END
    ELSE
    BEGIN
        PRINT '  [INFO] OnsiteCalculationDeletionAudit: No entries yet (will be populated on deletion)';
    END
END

PRINT '';

IF @WorkshopAuditTable = 1
BEGIN
    SELECT @WorkshopAuditCount = COUNT(*) FROM WorkshopCalculationDeletionAudit;

    IF @WorkshopAuditCount > 0
    BEGIN
        PRINT '  WorkshopCalculationDeletionAudit: ' + CAST(@WorkshopAuditCount AS NVARCHAR(10)) + ' entries';

        -- Show recent entries
        SELECT TOP 5
            DeletedAt,
            RunNumber,
            CreatorEmail,
            DeletedBy,
            ClientIP,
            DeletionReason,
            GrandTotal
        FROM WorkshopCalculationDeletionAudit
        ORDER BY DeletedAt DESC;
    END
    ELSE
    BEGIN
        PRINT '  [INFO] WorkshopCalculationDeletionAudit: No entries yet (will be populated on deletion)';
    END
END

PRINT '';

-- ================================================================
-- 6. Summary
-- ================================================================

PRINT '====================================================';
PRINT 'Diagnostic Summary';
PRINT '====================================================';

DECLARE @Issues INT = 0;

IF @OnsiteAuditTable = 0 SET @Issues = @Issues + 1;
IF @WorkshopAuditTable = 0 SET @Issues = @Issues + 1;
IF @OnsiteProc = 0 SET @Issues = @Issues + 1;
IF @WorkshopProc = 0 SET @Issues = @Issues + 1;

IF @Issues = 0
BEGIN
    PRINT '  [SUCCESS] All components verified';
    PRINT '';
    PRINT 'Next steps:';
    PRINT '  1. Test deletion from the UI or API';
    PRINT '  2. Verify audit entries are created';
    PRINT '  3. Check that ClientIP, UserAgent, and DeletionReason are captured';
END
ELSE
BEGIN
    PRINT '  [ISSUES FOUND] ' + CAST(@Issues AS NVARCHAR(10)) + ' component(s) missing';
    PRINT '';
    PRINT 'Please run the following migrations in order:';
    PRINT '  1. add_deletion_audit_tables.sql';
    PRINT '  2. update_delete_stored_procedures_for_audit.sql';
END

PRINT '====================================================';
PRINT '';
