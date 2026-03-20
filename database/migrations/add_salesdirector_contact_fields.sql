-- ============================================
-- Sales Director Signature Contact Fields
-- Migration: Add contact information fields to SalesDirectorSignatures
-- ============================================

-- Add contact fields to SalesDirectorSignatures table
ALTER TABLE SalesDirectorSignatures
ADD FullName NVARCHAR(255),
    PhoneNo NVARCHAR(50),
    Email NVARCHAR(255);

PRINT 'Sales Director contact fields added successfully.';