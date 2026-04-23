-- Run this script once on the SQL Server database before using the batch assignment feature.
-- This creates the Table-Valued Parameter type used by the optimized bulk assignment logic.

IF TYPE_ID(N'dbo.AssignmentTargetList') IS NULL
BEGIN
    CREATE TYPE dbo.AssignmentTargetList AS TABLE
    (
        ResHolidayXid INT          NOT NULL,
        ArrDate       DATE         NOT NULL,
        MaCa          VARCHAR(10)  NOT NULL
    );
END;
GO
