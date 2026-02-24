-- Migration: Add OnsiteCostPerHour column to Branches table
-- Purpose: Enable separate cost-per-hour rates for Onsite vs Workshop calculators
--
-- Onsite rates: {URY=485, USB=554, UPB=479, UCB=872}
-- Workshop rates: {URY=429, USB=431, USR=331, UKK=359, UPB=403, UCB=518}
-- Onsite only uses 4 branches (URY, USB, UPB, UCB) - USR and UKK are excluded

-- Add nullable column for zero-downtime deployment
ALTER TABLE dbo.Branches
ADD OnsiteCostPerHour DECIMAL(18,2) NULL;
GO

-- Populate onsite rates for the 4 onsite branches
UPDATE dbo.Branches SET OnsiteCostPerHour = 485 WHERE BranchName = 'URY';
UPDATE dbo.Branches SET OnsiteCostPerHour = 554 WHERE BranchName = 'USB';
UPDATE dbo.Branches SET OnsiteCostPerHour = 479 WHERE BranchName = 'UPB';
UPDATE dbo.Branches SET OnsiteCostPerHour = 872 WHERE BranchName = 'UCB';
GO

-- USR and UKK remain NULL (not used in Onsite calculator)
GO

-- Verify the migration
SELECT BranchId, BranchName, CostPerHour, OnsiteCostPerHour, OverheadPercent, PolicyProfit
FROM dbo.Branches
ORDER BY BranchName;
