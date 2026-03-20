-- ============================================
-- Sales Director Signature Management System
-- Migration: Add SalesDirectorSignatures table (fixed signature approach)
-- ============================================

-- Create SalesDirectorSignatures table (single row for the fixed signature)
CREATE TABLE SalesDirectorSignatures (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  SignatureData NVARCHAR(MAX) NOT NULL,
  FileName NVARCHAR(255) NOT NULL,
  ContentType NVARCHAR(50) NOT NULL,
  FileSizeBytes INT NOT NULL,
  UploadedBy NVARCHAR(255) NOT NULL,
  UploadedAt DATETIME2 DEFAULT GETUTCDATE(),
  UpdatedBy NVARCHAR(255),
  UpdatedAt DATETIME2
);

-- Ensure only one row exists (using a filtered index)
CREATE UNIQUE INDEX UX_SalesDirectorSignatures_Single
ON SalesDirectorSignatures(Id)
WHERE Id = 1;

-- Create audit table for tracking changes
CREATE TABLE SalesDirectorSignatureAudit (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Action NVARCHAR(20) NOT NULL, -- 'UPLOAD' or 'DELETE'
  OldSignatureData NVARCHAR(MAX) NULL,
  NewSignatureData NVARCHAR(MAX) NULL,
  FileName NVARCHAR(255),
  FileSizeBytes INT,
  ChangedBy NVARCHAR(255) NOT NULL,
  ClientIP NVARCHAR(50),
  ChangedAt DATETIME2 DEFAULT GETUTCDATE()
);

-- Create indexes for performance
CREATE INDEX IX_SalesDirectorSignatureAudit_ChangedAt 
ON SalesDirectorSignatureAudit(ChangedAt DESC);

PRINT 'Sales Director Signature Management System tables created successfully.';