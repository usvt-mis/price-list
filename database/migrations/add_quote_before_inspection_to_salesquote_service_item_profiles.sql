/*
 * Persist whether a Sales Quotes Service Item was quoted before inspection.
 * The flag is stored per Service Item/joblist profile and defaults to false.
 */

IF OBJECT_ID(N'dbo.SalesQuoteServiceItemProfiles', N'U') IS NULL
BEGIN
    PRINT 'SalesQuoteServiceItemProfiles table does not exist. Run the base service item labor migration first.';
END
ELSE IF COL_LENGTH('dbo.SalesQuoteServiceItemProfiles', 'QuoteBeforeInspection') IS NULL
BEGIN
    ALTER TABLE dbo.SalesQuoteServiceItemProfiles
    ADD QuoteBeforeInspection BIT NOT NULL
        CONSTRAINT DF_SalesQuoteServiceItemProfiles_QuoteBeforeInspection DEFAULT 0 WITH VALUES;

    PRINT 'Added QuoteBeforeInspection column to SalesQuoteServiceItemProfiles.';
END
ELSE
BEGIN
    PRINT 'QuoteBeforeInspection column already exists on SalesQuoteServiceItemProfiles.';
END
