IF COL_LENGTH('dbo.M_GuideBusy', 'Ca') IS NOT NULL
   AND COL_LENGTH('dbo.M_GuideBusy', 'Shift') IS NULL
BEGIN
    EXEC sp_rename 'dbo.M_GuideBusy.Ca', 'Shift', 'COLUMN';
END
GO

IF COL_LENGTH('dbo.M_GuideBusy', 'Shift') IS NULL
BEGIN
    ALTER TABLE dbo.M_GuideBusy
    ADD [Shift] VARCHAR(10) NULL;
END
GO

IF COL_LENGTH('dbo.M_GuideBusy', 'Shift') IS NOT NULL
BEGIN
    UPDATE dbo.M_GuideBusy
    SET [Shift] = 'ALL'
    WHERE [Shift] IS NULL OR LTRIM(RTRIM([Shift])) = '';
END
GO

IF COL_LENGTH('dbo.M_GuideBusy', 'ResHolidayXid') IS NULL
BEGIN
    ALTER TABLE dbo.M_GuideBusy
    ADD ResHolidayXid INT NULL;
END
GO

IF EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_M_GuideBusy_SupplierGuideXid_Date_Ca'
      AND object_id = OBJECT_ID('dbo.M_GuideBusy')
)
   AND NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_M_GuideBusy_SupplierGuideXid_Date_Shift'
      AND object_id = OBJECT_ID('dbo.M_GuideBusy')
)
BEGIN
    EXEC sp_rename
        'dbo.M_GuideBusy.IX_M_GuideBusy_SupplierGuideXid_Date_Ca',
        'IX_M_GuideBusy_SupplierGuideXid_Date_Shift',
        'INDEX';
END
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_M_GuideBusy_ResHolidayXid'
      AND object_id = OBJECT_ID('dbo.M_GuideBusy')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_M_GuideBusy_ResHolidayXid
        ON dbo.M_GuideBusy (ResHolidayXid)
        WHERE ResHolidayXid IS NOT NULL;
END
GO

-- Optional but recommended for luong tim guide ranh / tranh double booking.
IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_M_GuideBusy_SupplierGuideXid_Date_Shift'
      AND object_id = OBJECT_ID('dbo.M_GuideBusy')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_M_GuideBusy_SupplierGuideXid_Date_Shift
        ON dbo.M_GuideBusy (SupplierGuideXid, [Date], [Shift])
        INCLUDE (Busy, ResHolidayXid);
END
GO
