using Dapper;
using GuideManagement.Api.Models.ServiceGuideAssignments;

namespace GuideManagement.Api.Services;

public sealed class GuideAssignmentService(ISqlConnectionFactory connectionFactory) : IGuideAssignmentService
{
    private const int PendingAssignStatus = 1;
    private const int ConfirmedAssignStatus = 2;

    public async Task<AssignGuideToServiceResponse> AssignGuideToServiceAsync(
        AssignGuideToServiceRequest request,
        CancellationToken cancellationToken)
    {
        const string holidaySql = """
            SELECT TOP (1) CAST(rh.ArrDate AS date)
            FROM dbo.Res_Holidays rh
            WHERE rh.Pid = @ResHolidayXid;
            """;

        const string guideExistsSql = """
            SELECT TOP (1) 1
            FROM dbo.M_SupplierGuide g
            WHERE g.Pid = @SupplierGuideXid;
            """;

        const string conflictSql = """
            SELECT TOP (1) existing.ResHolidayXid
            FROM dbo.Res_HolidayGuide existing
            INNER JOIN dbo.Res_Holidays rh ON rh.Pid = existing.ResHolidayXid
            WHERE existing.SupplierGuideXid = @SupplierGuideXid
              AND existing.AssignStatus IN @ActiveStatuses
              AND CAST(rh.ArrDate AS date) = @ArrDate
              AND existing.ResHolidayXid <> @ResHolidayXid
            ORDER BY existing.AssignedDate DESC, existing.Pid DESC;
            """;

        const string insertSql = """
            INSERT INTO dbo.Res_HolidayGuide
            (
                ResHolidayXid,
                SupplierGuideXid,
                AssignStatus,
                AssignedBy,
                AssignedDate,
                OperatorNote
            )
            OUTPUT INSERTED.Pid
            VALUES
            (
                @ResHolidayXid,
                @SupplierGuideXid,
                @AssignStatus,
                @AssignedBy,
                @AssignedDate,
                @OperatorNote
            );
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var arrDateValue = await connection.QuerySingleOrDefaultAsync<DateTime?>(
            new CommandDefinition(
                holidaySql,
                new { request.ResHolidayXid },
                cancellationToken: cancellationToken));

        if (!arrDateValue.HasValue)
        {
            throw new KeyNotFoundException($"Res_Holiday {request.ResHolidayXid} was not found.");
        }

        var arrDate = DateOnly.FromDateTime(arrDateValue.Value);

        var guideExists = await connection.QuerySingleOrDefaultAsync<int?>(
            new CommandDefinition(
                guideExistsSql,
                new { request.SupplierGuideXid },
                cancellationToken: cancellationToken));

        if (!guideExists.HasValue)
        {
            throw new KeyNotFoundException($"Guide {request.SupplierGuideXid} was not found.");
        }

        // A guide cannot be assigned twice on the same service date when an existing
        // assignment is still active (Pending or Confirmed) on another Res_Holiday.
        var conflictingResHolidayXid = await connection.QuerySingleOrDefaultAsync<int?>(
            new CommandDefinition(
                conflictSql,
                new
                {
                    request.ResHolidayXid,
                    request.SupplierGuideXid,
                    ArrDate = arrDate.ToDateTime(TimeOnly.MinValue),
                    ActiveStatuses = new[] { PendingAssignStatus, ConfirmedAssignStatus }
                },
                cancellationToken: cancellationToken));

        if (conflictingResHolidayXid.HasValue)
        {
            throw new GuideAssignmentConflictException(
                $"Guide {request.SupplierGuideXid} is already booked on {arrDate:yyyy-MM-dd} for service {conflictingResHolidayXid.Value}.");
        }

        var assignedDateUtc = DateTime.UtcNow;
        var assignmentId = await connection.QuerySingleAsync<int>(
            new CommandDefinition(
                insertSql,
                new
                {
                    request.ResHolidayXid,
                    request.SupplierGuideXid,
                    AssignStatus = PendingAssignStatus,
                    request.AssignedBy,
                    AssignedDate = assignedDateUtc,
                    OperatorNote = request.OperatorNote.Trim()
                },
                cancellationToken: cancellationToken));

        return new AssignGuideToServiceResponse
        {
            Pid = assignmentId,
            ResHolidayXid = request.ResHolidayXid,
            SupplierGuideXid = request.SupplierGuideXid,
            AssignStatus = PendingAssignStatus,
            AssignedBy = request.AssignedBy,
            AssignedDateUtc = assignedDateUtc,
            OperatorNote = request.OperatorNote.Trim()
        };
    }
}
