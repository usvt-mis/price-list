-- ============================================
-- Salesperson Signature Management System
-- Migration: Add SalespersonSignatures and Audit tables
-- ============================================

-- Create SalespersonSignatures table
CREATE TABLE SalespersonSignatures (
  SalespersonCode NVARCHAR(50) PRIMARY KEY,
  SignatureData NVARCHAR(MAX) NOT NULL,
  FileName NVARCHAR(255) NOT NULL,
  ContentType NVARCHAR(50) NOT NULL,
  FileSizeBytes INT NOT NULL,
  UploadedBy NVARCHAR(255) NOT NULL,
  UploadedAt DATETIME2 DEFAULT GETUTCDATE(),
  UpdatedBy NVARCHAR(255),
  UpdatedAt DATETIME2
);

-- Create SalespersonSignatureAudit table for tracking changes
CREATE TABLE SalespersonSignatureAudit (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  SalespersonCode NVARCHAR(50) NOT NULL,
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
CREATE INDEX IX_SalespersonSignatures_UploadedAt ON SalespersonSignatures(UploadedAt DESC);
CREATE INDEX IX_SalespersonSignatureAudit_SalespersonCode ON SalespersonSignatureAudit(SalespersonCode);
CREATE INDEX IX_SalespersonSignatureAudit_ChangedAt ON SalespersonSignatureAudit(ChangedAt DESC);

PRINT 'Salesperson Signature Management System tables created successfully.';
