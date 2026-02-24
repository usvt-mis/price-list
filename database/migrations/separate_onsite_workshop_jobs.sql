/**
 * Migration: Separate Onsite and Workshop Job Lists
 *
 * Adds CalculatorType column to Jobs and Jobs2MotorType tables
 * to support filtering jobs by calculator type.
 *
 * Values: 'onsite', 'workshop', 'shared'
 */

-- Check if migration already ran (CalculatorType column exists in Jobs)
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Jobs')
    AND name = 'CalculatorType'
)
BEGIN
    PRINT 'Adding CalculatorType column to Jobs table...';

    -- Add CalculatorType column to Jobs table (nullable initially)
    ALTER TABLE dbo.Jobs
    ADD CalculatorType VARCHAR(20) NULL;
END
GO

-- Update existing jobs to 'onsite' by default
UPDATE dbo.Jobs
SET CalculatorType = 'onsite'
WHERE CalculatorType IS NULL;
GO

-- Make column NOT NULL after setting defaults
ALTER TABLE dbo.Jobs
ALTER COLUMN CalculatorType VARCHAR(20) NOT NULL;
GO

-- Add check constraint for valid values
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Jobs')
    AND name = 'CK_Jobs_CalculatorType'
)
BEGIN
    ALTER TABLE dbo.Jobs
    ADD CONSTRAINT CK_Jobs_CalculatorType
    CHECK (CalculatorType IN ('onsite', 'workshop', 'shared'));
END
GO
PRINT 'Jobs table updated successfully.';
GO

-- Check if Jobs2MotorType already has CalculatorType
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Jobs2MotorType')
    AND name = 'CalculatorType'
)
BEGIN
    PRINT 'Adding CalculatorType column to Jobs2MotorType table...';

    -- Add CalculatorType column to Jobs2MotorType table (nullable initially)
    ALTER TABLE dbo.Jobs2MotorType
    ADD CalculatorType VARCHAR(20) NULL;
END
GO

-- Update existing records to 'onsite' by default
UPDATE dbo.Jobs2MotorType
SET CalculatorType = 'onsite'
WHERE CalculatorType IS NULL;
GO

-- Make column NOT NULL after setting defaults
ALTER TABLE dbo.Jobs2MotorType
ALTER COLUMN CalculatorType VARCHAR(20) NOT NULL;
GO

-- Add check constraint for valid values
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Jobs2MotorType')
    AND name = 'CK_Jobs2MotorType_CalculatorType'
)
BEGIN
    ALTER TABLE dbo.Jobs2MotorType
    ADD CONSTRAINT CK_Jobs2MotorType_CalculatorType
    CHECK (CalculatorType IN ('onsite', 'workshop', 'shared'));
END
GO
PRINT 'Jobs2MotorType table updated successfully.';
GO

-- Display summary
PRINT '';
PRINT '========================================';
PRINT 'Migration Summary';
PRINT '========================================';

SELECT
    CalculatorType,
    COUNT(*) AS JobCount
FROM dbo.Jobs
GROUP BY CalculatorType
ORDER BY CalculatorType;
GO

PRINT '';
PRINT 'Migration complete!';
PRINT 'To add workshop-specific jobs, update records to CalculatorType = ''workshop''';
PRINT 'Use CalculatorType = ''shared'' for jobs that apply to both calculators.';
GO
