/*
 * Create tables for persisting workshop-style labor profiles
 * per Sales Quotes Service Item No.
 */

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'SalesQuoteServiceItemProfiles'
)
BEGIN
    CREATE TABLE SalesQuoteServiceItemProfiles (
        ServiceItemNo NVARCHAR(50) NOT NULL PRIMARY KEY,
        ServiceItemDescription NVARCHAR(255) NULL,
        WorkType NVARCHAR(50) NOT NULL,
        ServiceType NVARCHAR(20) NULL,
        MotorKw DECIMAL(10, 2) NULL,
        MotorDriveType NVARCHAR(2) NULL,
        BranchId INT NULL,
        MotorTypeId INT NULL,
        CustomerNo NVARCHAR(50) NULL,
        GroupNo NVARCHAR(20) NULL,
        CreatedByEmail NVARCHAR(255) NOT NULL,
        UpdatedByEmail NVARCHAR(255) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SalesQuoteServiceItemProfiles_CreatedAt DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SalesQuoteServiceItemProfiles_UpdatedAt DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_SalesQuoteServiceItemProfiles_BranchId
        ON SalesQuoteServiceItemProfiles (BranchId);

    CREATE INDEX IX_SalesQuoteServiceItemProfiles_MotorTypeId
        ON SalesQuoteServiceItemProfiles (MotorTypeId);

    CREATE INDEX IX_SalesQuoteServiceItemProfiles_UpdatedAt
        ON SalesQuoteServiceItemProfiles (UpdatedAt);
END;

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'SalesQuoteServiceItemLaborJobs'
)
BEGIN
    CREATE TABLE SalesQuoteServiceItemLaborJobs (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ServiceItemNo NVARCHAR(50) NOT NULL,
        JobId INT NOT NULL,
        JobCode NVARCHAR(50) NULL,
        JobName NVARCHAR(255) NOT NULL,
        OriginalManHours DECIMAL(10, 2) NOT NULL CONSTRAINT DF_SalesQuoteServiceItemLaborJobs_OriginalManHours DEFAULT 0,
        EffectiveManHours DECIMAL(10, 2) NOT NULL CONSTRAINT DF_SalesQuoteServiceItemLaborJobs_EffectiveManHours DEFAULT 0,
        IsChecked BIT NOT NULL CONSTRAINT DF_SalesQuoteServiceItemLaborJobs_IsChecked DEFAULT 1,
        SortOrder INT NOT NULL CONSTRAINT DF_SalesQuoteServiceItemLaborJobs_SortOrder DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SalesQuoteServiceItemLaborJobs_CreatedAt DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SalesQuoteServiceItemLaborJobs_UpdatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_SalesQuoteServiceItemLaborJobs_ServiceItemNo
            FOREIGN KEY (ServiceItemNo) REFERENCES SalesQuoteServiceItemProfiles(ServiceItemNo) ON DELETE CASCADE
    );

    CREATE INDEX IX_SalesQuoteServiceItemLaborJobs_ServiceItemNo
        ON SalesQuoteServiceItemLaborJobs (ServiceItemNo);

    CREATE INDEX IX_SalesQuoteServiceItemLaborJobs_SortOrder
        ON SalesQuoteServiceItemLaborJobs (ServiceItemNo, SortOrder, Id);
END;
