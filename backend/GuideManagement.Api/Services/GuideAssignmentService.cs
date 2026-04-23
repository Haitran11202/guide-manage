using GuideManagement.Api.Models.ServiceGuideAssignments;
using Microsoft.Data.SqlClient;
using System.Data;

namespace GuideManagement.Api.Services;

public sealed class GuideAssignmentService(ISqlConnectionFactory connectionFactory) : IGuideAssignmentService
{
    private const int PendingAssignStatus = 1;
    private const string PendingBusyStatus = "P";
    private const string ConfirmedBusyStatus = "D";
    private const string PersonalBusyStatus = "B";
    private const string ActiveGuideFlag = "ON";
    private const string AllDayShiftCode = "ALL";
    private static readonly string[] ConcreteShiftCodes =
    [
        "M1",
        "M2",
        "A1",
        "A2",
        "E1",
        "E2",
        "N1",
        "N2"
    ];
    private static readonly HashSet<string> ValidShiftCodes =
    [
        ..ConcreteShiftCodes,
        AllDayShiftCode
    ];

    public async Task<IReadOnlyList<AvailableGuideDto>> SearchAvailableGuidesAsync(
        DateTime arrDate,
        string? maCa,
        CancellationToken cancellationToken)
    {
        var normalizedShiftCode = NormalizeShiftCode(maCa);
        var result = new List<AvailableGuideDto>();

        try
        {
            await using var connection = connectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);
            var shiftColumnSql = await GetGuideBusyShiftColumnSqlAsync(connection, null, cancellationToken);
            await using var command = new SqlCommand(BuildAvailableGuidesSql(shiftColumnSql), connection);
            command.Parameters.Add("@OnOff", SqlDbType.VarChar, 10).Value = ActiveGuideFlag;
            command.Parameters.Add("@ArrDate", SqlDbType.Date).Value = arrDate.Date;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var busyShiftsByGuide = new Dictionary<int, HashSet<string>>();
            var guideNames = new Dictionary<int, string>();

            while (await reader.ReadAsync(cancellationToken))
            {
                var guideId = reader.GetInt32(0);
                var guideName = reader.IsDBNull(1) ? string.Empty : reader.GetString(1).Trim();
                var busyShift = reader.IsDBNull(2) ? null : reader.GetString(2);
                var hasBusyRow = !reader.IsDBNull(3) && reader.GetInt32(3) == 1;
                var busyDate = reader.IsDBNull(4) ? (DateTime?)null : reader.GetDateTime(4).Date;

                guideNames[guideId] = guideName;
                if (!busyShiftsByGuide.TryGetValue(guideId, out var guideBusyShifts))
                {
                    guideBusyShifts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    busyShiftsByGuide[guideId] = guideBusyShifts;
                }

                foreach (var shiftCode in ExpandBusyShiftCodes(
                    busyShift,
                    hasBusyRow && busyDate.HasValue && busyDate.Value == arrDate.Date,
                    shiftColumnSql is not null))
                {
                    guideBusyShifts.Add(shiftCode);
                }
            }

            foreach (var guideEntry in guideNames.OrderBy(entry => entry.Value, StringComparer.OrdinalIgnoreCase))
            {
                var guideBusyShifts = busyShiftsByGuide.TryGetValue(guideEntry.Key, out var shifts)
                    ? shifts
                    : new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var availableShiftCodes = ConcreteShiftCodes
                    .Where(shiftCode => !guideBusyShifts.Contains(shiftCode))
                    .ToArray();

                result.Add(new AvailableGuideDto
                {
                    GuideId = guideEntry.Key,
                    GuideName = guideEntry.Value,
                    BusyShiftCodes = guideBusyShifts.OrderBy(value => value).ToArray(),
                    AvailableShiftCodes = availableShiftCodes
                });
            }

            return result;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("Failed to search available guides.", exception);
        }
    }

    public async Task<IReadOnlyList<AvailableGuideDto>> SearchAvailableGuidesAsync(
        IReadOnlyList<DateTime> arrDates,
        string? maCa,
        CancellationToken cancellationToken)
    {
        var normalizedDates = arrDates
            .Select(value => value.Date)
            .Distinct()
            .OrderBy(value => value)
            .ToArray();

        if (normalizedDates.Length == 0)
        {
            return [];
        }

        IReadOnlyList<AvailableGuideDto>? aggregated = null;
        foreach (var arrDate in normalizedDates)
        {
            var dailyAvailability = await SearchAvailableGuidesAsync(arrDate, maCa, cancellationToken);
            aggregated = aggregated is null
                ? dailyAvailability
                : AggregateAvailableGuides(aggregated, dailyAvailability);
        }

        return aggregated ?? [];
    }

    public async Task<AssignGuideToServiceResponse> AssignGuideToServiceAsync(
        AssignGuideToServiceRequest request,
        CancellationToken cancellationToken)
    {
        var result = await AssignGuideToServicesInternalAsync(
            request.SupplierGuideXid,
            [new AssignmentTarget(request.ResHolidayXid, request.ArrDate)],
            request.MaCa,
            request.AssignedBy,
            request.OperatorNote,
            cancellationToken);

        return result.Assignments[0];
    }

    public async Task<AssignGuideToServicesResponse> AssignGuideToServicesAsync(
        AssignGuideToServicesRequest request,
        CancellationToken cancellationToken)
        => await AssignGuideToServicesInternalAsync(
            request.SupplierGuideXid,
            request.Items
                .Select(item => new AssignmentTarget(item.ResHolidayXid, item.ArrDate))
                .ToArray(),
            request.MaCa,
            request.AssignedBy,
            request.OperatorNote,
            cancellationToken);

    private async Task<AssignGuideToServicesResponse> AssignGuideToServicesInternalAsync(
        int guideId,
        IReadOnlyList<AssignmentTarget> targets,
        string? maCa,
        int assignedBy,
        string? operatorNote,
        CancellationToken cancellationToken)
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var normalizedShiftCode = NormalizeShiftCode(maCa);
            var normalizedOperatorNote = (operatorNote ?? string.Empty).Trim();
            var normalizedTargets = targets
                .Where(target => target.ResHolidayXid > 0)
                .GroupBy(target => target.ResHolidayXid)
                .Select(group =>
                {
                    var first = group.First();
                    var normalizedDate = first.ArrDate?.Date;

                    if (group.Any(item => item.ArrDate?.Date != normalizedDate))
                    {
                        throw new ArgumentException($"Conflicting ArrDate values were supplied for ResHoliday {group.Key}.");
                    }

                    return new AssignmentTarget(group.Key, normalizedDate);
                })
                .ToArray();

            if (guideId <= 0)
            {
                throw new ArgumentException("Guide id must be greater than 0.");
            }

            if (assignedBy <= 0)
            {
                throw new ArgumentException("AssignedBy must be greater than 0.");
            }

            if (normalizedTargets.Length == 0)
            {
                throw new ArgumentException("At least one assignment item is required.");
            }

            var shiftColumnSql = await GetGuideBusyShiftColumnSqlAsync(connection, transaction, cancellationToken);
            await EnsureGuideExistsAsync(guideId, connection, transaction, cancellationToken);

            // Resolve ArrDate for any targets that didn't supply one (single batch query).
            var resolvedTargets = await ResolveArrDatesAsync(
                normalizedTargets, connection, transaction, cancellationToken);

            // One round-trip: check all targets for availability conflicts.
            await EnsureGuideIsAvailableBatchAsync(
                guideId,
                resolvedTargets,
                normalizedShiftCode,
                shiftColumnSql,
                connection,
                transaction,
                cancellationToken);

            // One round-trip: insert all Res_HolidayGuide rows and get their generated Pids.
            var assignmentPids = await InsertGuideAssignmentsBatchAsync(
                guideId, resolvedTargets, connection, transaction, cancellationToken);

            // One round-trip: insert all M_GuideBusy rows.
            await InsertGuideBusyBatchAsync(
                guideId,
                resolvedTargets,
                normalizedShiftCode,
                PendingBusyStatus,
                shiftColumnSql,
                connection,
                transaction,
                cancellationToken);

            var now = DateTime.UtcNow;
            var assignments = resolvedTargets
                .Select((target, index) => new AssignGuideToServiceResponse
                {
                    Pid = assignmentPids[index],
                    ResHolidayXid = target.ResHolidayXid,
                    SupplierGuideXid = guideId,
                    ArrDate = target.ArrDate!.Value,
                    MaCa = normalizedShiftCode,
                    BusyStatus = PendingBusyStatus,
                    AssignStatus = PendingAssignStatus,
                    AssignedBy = assignedBy,
                    AssignedDateUtc = now,
                    OperatorNote = normalizedOperatorNote
                })
                .ToList();

            await transaction.CommitAsync(cancellationToken);

            return new AssignGuideToServicesResponse
            {
                MaCa = normalizedShiftCode,
                SupplierGuideXid = guideId,
                AssignedBy = assignedBy,
                AssignedDateUtc = DateTime.UtcNow,
                Assignments = assignments
            };
        }
        catch
        {
            await RollbackAsync(transaction);
            throw;
        }
    }

    public async Task ConfirmServiceGuideAsync(int resHolidayId, CancellationToken cancellationToken)
    {
        const string updateHolidaySql = """
            UPDATE dbo.Res_Holidays
            SET StatusXid = 4
            WHERE Pid = @ResHolidayId;
            """;

        const string updateBusySql = """
            UPDATE dbo.M_GuideBusy
            SET Busy = @Busy
            WHERE ResHolidayXid = @ResHolidayId;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            await using (var holidayCommand = new SqlCommand(updateHolidaySql, connection, transaction))
            {
                holidayCommand.Parameters.Add("@ResHolidayId", SqlDbType.Int).Value = resHolidayId;
                var affectedRows = await holidayCommand.ExecuteNonQueryAsync(cancellationToken);
                if (affectedRows == 0)
                {
                    throw new KeyNotFoundException($"Res_Holiday {resHolidayId} was not found.");
                }
            }

            await using (var busyCommand = new SqlCommand(updateBusySql, connection, transaction))
            {
                busyCommand.Parameters.Add("@Busy", SqlDbType.VarChar, 5).Value = ConfirmedBusyStatus;
                busyCommand.Parameters.Add("@ResHolidayId", SqlDbType.Int).Value = resHolidayId;
                await busyCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            await RollbackAsync(transaction);
            if (exception is KeyNotFoundException)
            {
                throw;
            }

            throw new InvalidOperationException($"Failed to confirm service {resHolidayId}.", exception);
        }
    }

    public async Task UnassignGuideAsync(int resHolidayId, int guideId, CancellationToken cancellationToken)
    {
        const string deleteBusySql = """
            DELETE FROM dbo.M_GuideBusy
            WHERE ResHolidayXid = @ResHolidayId
              AND SupplierGuideXid = @GuideId;
            """;

        const string deleteAssignmentSql = """
            DELETE FROM dbo.Res_HolidayGuide
            WHERE ResHolidayXid = @ResHolidayId
              AND SupplierGuideXid = @GuideId;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            await using (var busyCommand = new SqlCommand(deleteBusySql, connection, transaction))
            {
                busyCommand.Parameters.Add("@ResHolidayId", SqlDbType.Int).Value = resHolidayId;
                busyCommand.Parameters.Add("@GuideId", SqlDbType.Int).Value = guideId;
                await busyCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var assignmentCommand = new SqlCommand(deleteAssignmentSql, connection, transaction))
            {
                assignmentCommand.Parameters.Add("@ResHolidayId", SqlDbType.Int).Value = resHolidayId;
                assignmentCommand.Parameters.Add("@GuideId", SqlDbType.Int).Value = guideId;
                await assignmentCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            await RollbackAsync(transaction);
            throw new InvalidOperationException(
                $"Failed to unassign guide {guideId} from service {resHolidayId}.",
                exception);
        }
    }

    public async Task MarkGuidePersonalBusyAsync(
        MarkGuidePersonalBusyRequest request,
        CancellationToken cancellationToken)
    {
        const string insertBusySqlWithoutShift = """
            INSERT INTO dbo.M_GuideBusy
            (
                SupplierGuideXid,
                [Date],
                Busy,
                ResHolidayXid
            )
            VALUES
            (
                @GuideId,
                @DateNghi,
                @Busy,
                @ResHolidayXid
            );
            """;

        var normalizedShiftCode = NormalizeShiftCode(request.CaNghi);

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        try
        {
            var shiftColumnSql = await GetGuideBusyShiftColumnSqlAsync(connection, null, cancellationToken);
            await EnsureGuideExistsAsync(request.GuideId, connection, null, cancellationToken);
            if (shiftColumnSql is not null)
            {
                foreach (var shiftCode in ExpandShiftCodes(normalizedShiftCode))
                {
                    await using var command = new SqlCommand(BuildInsertPersonalBusySqlWithShift(shiftColumnSql), connection);
                    command.Parameters.Add("@GuideId", SqlDbType.Int).Value = request.GuideId;
                    command.Parameters.Add("@DateNghi", SqlDbType.Date).Value = request.DateNghi.Date;
                    command.Parameters.Add("@CaNghi", SqlDbType.VarChar, 10).Value = shiftCode;
                    command.Parameters.Add("@Busy", SqlDbType.VarChar, 5).Value = PersonalBusyStatus;
                    command.Parameters.Add("@ResHolidayXid", SqlDbType.Int).Value = DBNull.Value;
                    await command.ExecuteNonQueryAsync(cancellationToken);
                }
            }
            else
            {
                await using var command = new SqlCommand(insertBusySqlWithoutShift, connection);
                command.Parameters.Add("@GuideId", SqlDbType.Int).Value = request.GuideId;
                command.Parameters.Add("@DateNghi", SqlDbType.Date).Value = request.DateNghi.Date;
                command.Parameters.Add("@Busy", SqlDbType.VarChar, 5).Value = PersonalBusyStatus;
                command.Parameters.Add("@ResHolidayXid", SqlDbType.Int).Value = DBNull.Value;
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
        catch (Exception exception)
        {
            if (exception is KeyNotFoundException)
            {
                throw;
            }

            throw new InvalidOperationException(
                $"Failed to mark guide {request.GuideId} as personal busy.",
                exception);
        }
    }

    /// <summary>
    /// Resolves <c>ArrDate</c> for targets that didn't supply one by fetching them
    /// from <c>Res_Holidays</c> in a single query using an IN clause.
    /// </summary>
    private static async Task<AssignmentTarget[]> ResolveArrDatesAsync(
        AssignmentTarget[] targets,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        var missing = targets
            .Where(t => t.ArrDate is null)
            .Select(t => t.ResHolidayXid)
            .Distinct()
            .ToArray();

        if (missing.Length == 0)
        {
            // All targets already have ArrDate — normalise to .Date and return.
            return targets
                .Select(t => new AssignmentTarget(t.ResHolidayXid, t.ArrDate!.Value.Date))
                .ToArray();
        }

        var inClause = string.Join(", ", missing.Select((_, i) => $"@MissingId{i}"));
        var sql = $"""
            SELECT Pid, CAST(ArrDate AS date)
            FROM dbo.Res_Holidays
            WHERE Pid IN ({inClause});
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        for (var i = 0; i < missing.Length; i++)
        {
            command.Parameters.Add($"@MissingId{i}", SqlDbType.Int).Value = missing[i];
        }

        var dateMap = new Dictionary<int, DateTime>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            dateMap[reader.GetInt32(0)] = reader.GetDateTime(1).Date;
        }

        return targets.Select(t =>
        {
            var date = t.ArrDate?.Date
                ?? (dateMap.TryGetValue(t.ResHolidayXid, out var d)
                    ? d
                    : throw new KeyNotFoundException($"Res_Holiday {t.ResHolidayXid} was not found."));
            return new AssignmentTarget(t.ResHolidayXid, date);
        }).ToArray();
    }

    /// <summary>
    /// Checks all targets for guide availability in a single query.
    /// Throws <see cref="GuideAssignmentConflictException"/> on the first conflict found.
    /// </summary>
    private static async Task EnsureGuideIsAvailableBatchAsync(
        int guideId,
        AssignmentTarget[] targets,
        string maCa,
        string? shiftColumnSql,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        // Build an OR chain: (Date = @ArrDate0 AND ...) OR (Date = @ArrDate1 AND ...) ...
        // We also exclude the ResHolidayXids that are part of *this* batch (they don't
        // exist yet, but defensive against duplicate calls).
        var allowedIds = targets.Select(t => t.ResHolidayXid).ToArray();
        var exclusionClause = BuildAllowedResHolidayExclusionClause(allowedIds);

        var dateClauses = targets
            .Select((_, i) => $"CAST(gb.[Date] AS date) = @ArrDate{i}")
            .ToArray();

        string sql;
        if (shiftColumnSql is not null)
        {
            sql = $"""
                SELECT TOP (1) COALESCE(gb.ResHolidayXid, 0), CAST(gb.[Date] AS date)
                FROM dbo.M_GuideBusy gb WITH (UPDLOCK, HOLDLOCK)
                WHERE gb.SupplierGuideXid = @GuideId
                  AND ({string.Join(" OR ", dateClauses)})
                  AND
                  (
                      @MaCa = @AllDayShiftCode
                      OR UPPER(LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, '')))) = @MaCa
                      OR UPPER(LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, '')))) = @AllDayShiftCode
                      OR LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, ''))) = ''
                  )
                  AND {exclusionClause};
                """;
        }
        else
        {
            sql = $"""
                SELECT TOP (1) COALESCE(gb.ResHolidayXid, 0), CAST(gb.[Date] AS date)
                FROM dbo.M_GuideBusy gb WITH (UPDLOCK, HOLDLOCK)
                WHERE gb.SupplierGuideXid = @GuideId
                  AND ({string.Join(" OR ", dateClauses)})
                  AND {exclusionClause};
                """;
        }

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@GuideId", SqlDbType.Int).Value = guideId;
        if (shiftColumnSql is not null)
        {
            command.Parameters.Add("@MaCa", SqlDbType.VarChar, 10).Value = maCa;
            command.Parameters.Add("@AllDayShiftCode", SqlDbType.VarChar, 10).Value = AllDayShiftCode;
        }

        for (var i = 0; i < targets.Length; i++)
        {
            command.Parameters.Add($"@ArrDate{i}", SqlDbType.Date).Value = targets[i].ArrDate!.Value.Date;
        }

        AddAllowedResHolidayParameters(command, allowedIds);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var conflictingResHolidayId = reader.GetInt32(0);
            var conflictDate = reader.GetDateTime(1);
            var conflictTarget = conflictingResHolidayId == 0
                ? "a personal busy record"
                : $"service {conflictingResHolidayId}";

            throw new GuideAssignmentConflictException(
                $"Guide {guideId} is already busy on {conflictDate:yyyy-MM-dd} ({maCa}) for {conflictTarget}.");
        }
    }

    /// <summary>
    /// Inserts all assignment rows into <c>Res_HolidayGuide</c> in a single batch
    /// and returns the generated <c>Pid</c> values in the same order as <paramref name="targets"/>.
    /// </summary>
    private static async Task<int[]> InsertGuideAssignmentsBatchAsync(
        int guideId,
        AssignmentTarget[] targets,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        // Build VALUES list: (@RhXid0,@Guide,@Status), (@RhXid1,@Guide,@Status), ...
        var valueRows = targets
            .Select((_, i) => $"(@ResHolidayXid{i}, @GuideId, @AssignStatus)")
            .ToArray();

        var sql = $"""
            INSERT INTO dbo.Res_HolidayGuide
            (
                ResHolidayXid,
                SupplierGuideXid,
                AssignStatus
            )
            OUTPUT INSERTED.ResHolidayXid, INSERTED.Pid
            VALUES
            {string.Join(",\n", valueRows)};
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@GuideId", SqlDbType.Int).Value = guideId;
        command.Parameters.Add("@AssignStatus", SqlDbType.Int).Value = PendingAssignStatus;
        for (var i = 0; i < targets.Length; i++)
        {
            command.Parameters.Add($"@ResHolidayXid{i}", SqlDbType.Int).Value = targets[i].ResHolidayXid;
        }

        // Map ResHolidayXid → Pid from OUTPUT clause.
        var pidByResHoliday = new Dictionary<int, int>(targets.Length);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            pidByResHoliday[reader.GetInt32(0)] = reader.GetInt32(1);
        }

        return targets
            .Select(t => pidByResHoliday.TryGetValue(t.ResHolidayXid, out var pid) ? pid : 0)
            .ToArray();
    }

    /// <summary>
    /// Inserts all busy rows into <c>M_GuideBusy</c> in a single batch.
    /// When <c>MaCa = ALL</c>, expands to all concrete shift codes per target.
    /// </summary>
    private static async Task InsertGuideBusyBatchAsync(
        int guideId,
        AssignmentTarget[] targets,
        string maCa,
        string busyStatus,
        string? shiftColumnSql,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        // Build the full list of (ResHolidayXid, ArrDate, ShiftCode) rows to insert.
        var rows = targets
            .SelectMany(t => ExpandShiftCodes(maCa)
                .Select(shift => (t.ResHolidayXid, t.ArrDate!.Value.Date, shift)))
            .ToArray();

        if (rows.Length == 0) return;

        string sql;
        IReadOnlyList<string> valueRows;

        if (shiftColumnSql is not null)
        {
            valueRows = rows
                .Select((_, i) => $"(@GuideId, @ArrDate{i}, @MaCa{i}, @Busy, @ResHolidayXid{i})")
                .ToArray();

            sql = $"""
                INSERT INTO dbo.M_GuideBusy
                (
                    SupplierGuideXid,
                    [Date],
                    {shiftColumnSql},
                    Busy,
                    ResHolidayXid
                )
                VALUES
                {string.Join(",\n", valueRows)};
                """;
        }
        else
        {
            valueRows = rows
                .Select((_, i) => $"(@GuideId, @ArrDate{i}, @Busy, @ResHolidayXid{i})")
                .ToArray();

            sql = $"""
                INSERT INTO dbo.M_GuideBusy
                (
                    SupplierGuideXid,
                    [Date],
                    Busy,
                    ResHolidayXid
                )
                VALUES
                {string.Join(",\n", valueRows)};
                """;
        }

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@GuideId", SqlDbType.Int).Value = guideId;
        command.Parameters.Add("@Busy", SqlDbType.VarChar, 5).Value = busyStatus;

        for (var i = 0; i < rows.Length; i++)
        {
            var (resHolidayXid, arrDate, shift) = rows[i];
            command.Parameters.Add($"@ArrDate{i}", SqlDbType.Date).Value = arrDate;
            command.Parameters.Add($"@ResHolidayXid{i}", SqlDbType.Int).Value = resHolidayXid;
            if (shiftColumnSql is not null)
            {
                command.Parameters.Add($"@MaCa{i}", SqlDbType.VarChar, 10).Value = shift;
            }
        }

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string NormalizeShiftCode(string? maCa)
    {
        if (string.IsNullOrWhiteSpace(maCa))
        {
            return AllDayShiftCode;
        }

        var normalized = maCa.Trim().ToUpperInvariant();
        if (!ValidShiftCodes.Contains(normalized))
        {
            throw new ArgumentException($"Shift code '{maCa}' is invalid.");
        }

        return normalized;
    }

    private static IReadOnlyList<string> ExpandShiftCodes(string shiftCode)
        => string.Equals(shiftCode, AllDayShiftCode, StringComparison.OrdinalIgnoreCase)
            ? ConcreteShiftCodes
            : [shiftCode];

    private static IReadOnlyList<string> ExpandBusyShiftCodes(string? shiftCode, bool hasBusyRow, bool hasShiftColumn)
    {
        if (!hasBusyRow)
        {
            return [];
        }

        if (!hasShiftColumn)
        {
            return ConcreteShiftCodes;
        }

        var normalized = (shiftCode ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized) || string.Equals(normalized, AllDayShiftCode, StringComparison.OrdinalIgnoreCase))
        {
            return ConcreteShiftCodes;
        }

        return ValidShiftCodes.Contains(normalized) ? [normalized] : ConcreteShiftCodes;
    }

    private static IReadOnlyList<AvailableGuideDto> AggregateAvailableGuides(
        IReadOnlyList<AvailableGuideDto> current,
        IReadOnlyList<AvailableGuideDto> next)
    {
        var nextByGuideId = next.ToDictionary(item => item.GuideId);

        return current
            .Where(item => nextByGuideId.ContainsKey(item.GuideId))
            .Select(item =>
            {
                var nextItem = nextByGuideId[item.GuideId];
                var busyShiftCodes = item.BusyShiftCodes
                    .Concat(nextItem.BusyShiftCodes)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                var availableShiftCodes = item.AvailableShiftCodes
                    .Intersect(nextItem.AvailableShiftCodes, StringComparer.OrdinalIgnoreCase)
                    .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                return new AvailableGuideDto
                {
                    GuideId = item.GuideId,
                    GuideName = item.GuideName,
                    BusyShiftCodes = busyShiftCodes,
                    AvailableShiftCodes = availableShiftCodes
                };
            })
            .OrderBy(item => item.GuideName, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static async Task RollbackAsync(SqlTransaction transaction)
    {
        if (transaction.Connection is not null)
        {
            await transaction.RollbackAsync(CancellationToken.None);
        }
    }

    // InsertGuideAssignmentAsync and InsertGuideBusyAsync have been replaced by the
    // batch equivalents InsertGuideAssignmentsBatchAsync / InsertGuideBusyBatchAsync above.

    private static async Task EnsureGuideExistsAsync(
        int guideId,
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) 1
            FROM dbo.M_SupplierGuide
            WHERE Pid = @GuideId;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@GuideId", SqlDbType.Int).Value = guideId;
        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (result is null)
        {
            throw new KeyNotFoundException($"Guide {guideId} was not found.");
        }
    }

    private static async Task<DateTime> GetArrDateByResHolidayIdAsync(
        int resHolidayId,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) CAST(rh.ArrDate AS date)
            FROM dbo.Res_Holidays rh
            WHERE rh.Pid = @ResHolidayId;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@ResHolidayId", SqlDbType.Int).Value = resHolidayId;
        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (result is null or DBNull)
        {
            throw new KeyNotFoundException($"Res_Holiday {resHolidayId} was not found.");
        }

        return Convert.ToDateTime(result);
    }

    private sealed record AssignmentTarget(int ResHolidayXid, DateTime? ArrDate);

    // EnsureGuideIsAvailableAsync (per-target) has been replaced by
    // EnsureGuideIsAvailableBatchAsync which checks all targets in one query.

    private static async Task<string?> GetGuideBusyShiftColumnSqlAsync(
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT CASE
                       WHEN COL_LENGTH('dbo.M_GuideBusy', 'Shift') IS NOT NULL THEN 'Shift'
                       WHEN COL_LENGTH('dbo.M_GuideBusy', 'Ca') IS NOT NULL THEN 'Ca'
                       ELSE NULL
                   END;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (result is null or DBNull)
        {
            return null;
        }

        var columnName = Convert.ToString(result);
        return columnName switch
        {
            "Shift" => "[Shift]",
            "Ca" => "[Ca]",
            _ => null
        };
    }

    private static string BuildAvailableGuidesSql(string? shiftColumnSql) => shiftColumnSql is not null
        ? $"""
        SELECT
            g.Pid,
            LTRIM(RTRIM(ISNULL(g.Guide, ''))) AS GuideName,
            CAST(gb.{shiftColumnSql} AS varchar(10)) AS BusyShiftCode,
            CASE WHEN gb.Pid IS NULL THEN 0 ELSE 1 END AS HasBusyRow,
            CAST(gb.[Date] AS date) AS BusyDate
        FROM dbo.M_SupplierGuide g
        LEFT JOIN dbo.M_GuideBusy gb
            ON gb.SupplierGuideXid = g.Pid
           AND CAST(gb.[Date] AS date) = @ArrDate
        WHERE UPPER(LTRIM(RTRIM(ISNULL(g.OnOff, '')))) = @OnOff
        ORDER BY g.Guide, gb.Pid;
        """
        : """
        SELECT
            g.Pid,
            LTRIM(RTRIM(ISNULL(g.Guide, ''))) AS GuideName,
            CAST(NULL AS varchar(10)) AS BusyShiftCode,
            CASE WHEN gb.Pid IS NULL THEN 0 ELSE 1 END AS HasBusyRow,
            CAST(gb.[Date] AS date) AS BusyDate
        FROM dbo.M_SupplierGuide g
        LEFT JOIN dbo.M_GuideBusy gb
            ON gb.SupplierGuideXid = g.Pid
           AND CAST(gb.[Date] AS date) = @ArrDate
        WHERE UPPER(LTRIM(RTRIM(ISNULL(g.OnOff, '')))) = @OnOff
        ORDER BY g.Guide, gb.Pid;
        """;

    private static string BuildAvailableGuidesSqlWithShift(string? shiftColumnSql) => $"""
        SELECT
            g.Pid,
            LTRIM(RTRIM(ISNULL(g.Guide, ''))) AS GuideName
        FROM dbo.M_SupplierGuide g
        WHERE UPPER(LTRIM(RTRIM(ISNULL(g.OnOff, '')))) = @OnOff
          AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.M_GuideBusy gb
              WHERE gb.SupplierGuideXid = g.Pid
                AND CAST(gb.[Date] AS date) = @ArrDate
                AND
                (
                    @MaCa = @AllDayShiftCode
                    OR UPPER(LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, '')))) = @MaCa
                    OR UPPER(LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, '')))) = @AllDayShiftCode
                    OR LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, ''))) = ''
                )
          )
        ORDER BY g.Guide;
        """;

    private static string BuildInsertGuideBusySqlWithShift(string? shiftColumnSql) => $"""
        INSERT INTO dbo.M_GuideBusy
        (
            SupplierGuideXid,
            [Date],
            {shiftColumnSql},
            Busy,
            ResHolidayXid
        )
        VALUES
        (
            @SupplierGuideXid,
            @ArrDate,
            @MaCa,
            @Busy,
            @ResHolidayXid
        );
        """;

    private static string BuildInsertPersonalBusySqlWithShift(string? shiftColumnSql) => $"""
        INSERT INTO dbo.M_GuideBusy
        (
            SupplierGuideXid,
            [Date],
            {shiftColumnSql},
            Busy,
            ResHolidayXid
        )
        VALUES
        (
            @GuideId,
            @DateNghi,
            @CaNghi,
            @Busy,
            @ResHolidayXid
        );
        """;

    private static void AddAllowedResHolidayParameters(SqlCommand command, IReadOnlyCollection<int> allowedResHolidayIds)
    {
        var index = 0;
        foreach (var resHolidayId in allowedResHolidayIds.Where(id => id > 0).Distinct())
        {
            command.Parameters.Add($"@AllowedResHolidayId{index}", SqlDbType.Int).Value = resHolidayId;
            index += 1;
        }
    }

    private static string BuildAllowedResHolidayExclusionClause(IReadOnlyCollection<int> allowedResHolidayIds)
    {
        var allowedIds = allowedResHolidayIds
            .Where(id => id > 0)
            .Distinct()
            .Select((_, index) => $"@AllowedResHolidayId{index}")
            .ToArray();

        return allowedIds.Length == 0
            ? "gb.ResHolidayXid IS NULL OR gb.ResHolidayXid <> -1"
            : $"(gb.ResHolidayXid IS NULL OR gb.ResHolidayXid NOT IN ({string.Join(", ", allowedIds)}))";
    }

    private static string BuildEnsureGuideAvailableSqlWithShift(string? shiftColumnSql, string exclusionClause) => $"""
        SELECT TOP (1) COALESCE(gb.ResHolidayXid, 0)
        FROM dbo.M_GuideBusy gb WITH (UPDLOCK, HOLDLOCK)
        WHERE gb.SupplierGuideXid = @GuideId
          AND CAST(gb.[Date] AS date) = @ArrDate
          AND
          (
              @MaCa = @AllDayShiftCode
              OR UPPER(LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, '')))) = @MaCa
              OR UPPER(LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, '')))) = @AllDayShiftCode
              OR LTRIM(RTRIM(ISNULL(gb.{shiftColumnSql}, ''))) = ''
          )
          AND {exclusionClause};
        """;
}
