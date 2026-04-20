/*
 * Add the Sales Quotes manual "Other" job.
 *
 * This job is intentionally stored as a shared master job so Sales Quotes can
 * request it from both workshop and onsite labor endpoints. The endpoints hide
 * it by default unless includeManualOther=true is passed.
 */

SET NOCOUNT ON;

DECLARE @ManualOtherJobCode NVARCHAR(50) = N'SQ-OTHER';
DECLARE @ManualOtherJobName NVARCHAR(255) = N'อื่นๆ';
DECLARE @NextSortOrder INT;

SELECT @NextSortOrder = COALESCE(MAX(SortOrder), 0) + 10
FROM dbo.Jobs;

IF NOT EXISTS (
    SELECT 1
    FROM dbo.Jobs
    WHERE JobCode = @ManualOtherJobCode
)
BEGIN
    IF COL_LENGTH('dbo.Jobs', 'IsActive') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql
            N'
                INSERT INTO dbo.Jobs (
                    JobCode,
                    JobName,
                    CalculatorType,
                    SortOrder,
                    IsActive
                )
                VALUES (
                    @ManualOtherJobCode,
                    @ManualOtherJobName,
                    N''shared'',
                    @NextSortOrder,
                    1
                );
            ',
            N'@ManualOtherJobCode NVARCHAR(50), @ManualOtherJobName NVARCHAR(255), @NextSortOrder INT',
            @ManualOtherJobCode = @ManualOtherJobCode,
            @ManualOtherJobName = @ManualOtherJobName,
            @NextSortOrder = @NextSortOrder;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Jobs (
            JobCode,
            JobName,
            CalculatorType,
            SortOrder
        )
        VALUES (
            @ManualOtherJobCode,
            @ManualOtherJobName,
            N'shared',
            @NextSortOrder
        );
    END
END
ELSE
BEGIN
    IF COL_LENGTH('dbo.Jobs', 'IsActive') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql
            N'
                UPDATE dbo.Jobs
                SET JobName = @ManualOtherJobName,
                    CalculatorType = N''shared'',
                    IsActive = 1
                WHERE JobCode = @ManualOtherJobCode;
            ',
            N'@ManualOtherJobCode NVARCHAR(50), @ManualOtherJobName NVARCHAR(255)',
            @ManualOtherJobCode = @ManualOtherJobCode,
            @ManualOtherJobName = @ManualOtherJobName;
    END
    ELSE
    BEGIN
        UPDATE dbo.Jobs
        SET JobName = @ManualOtherJobName,
            CalculatorType = N'shared'
        WHERE JobCode = @ManualOtherJobCode;
    END
END;
