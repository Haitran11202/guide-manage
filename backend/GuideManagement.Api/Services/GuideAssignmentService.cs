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

                guideNames[guideId] = guideName;
                if (!busyShiftsByGuide.TryGetValue(guideId, out var guideBusyShifts))
                {
                    guideBusyShifts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    busyShiftsByGuide[guideId] = guideBusyShifts;
                }

                foreach (var shiftCode in ExpandBusyShiftCodes(busyShift, hasBusyRow, shiftColumnSql is not null))
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
            var assignments = new List<AssignGuideToServiceResponse>(normalizedTargets.Length);

            foreach (var target in normalizedTargets)
            {
                var assignment = await AssignGuideToSingleServiceAsync(
                    guideId,
                    target.ResHolidayXid,
                    target.ArrDate,
                    normalizedShiftCode,
                    assignedBy,
                    normalizedOperatorNote,
                    shiftColumnSql,
                    connection,
                    transaction,
                    cancellationToken);

                assignments.Add(assignment);
            }

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

    private static async Task<AssignGuideToServiceResponse> AssignGuideToSingleServiceAsync(
        int guideId,
        int resHolidayId,
        DateTime? arrDate,
        string normalizedShiftCode,
        int assignedBy,
        string normalizedOperatorNote,
        string? shiftColumnSql,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string insertAssignmentSql = """
            INSERT INTO dbo.Res_HolidayGuide
            (
                ResHolidayXid,
                SupplierGuideXid,
                AssignStatus
            )
            OUTPUT INSERTED.Pid
            VALUES
            (
                @ResHolidayXid,
                @SupplierGuideXid,
                @AssignStatus
            );
            """;

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
                @SupplierGuideXid,
                @ArrDate,
                @Busy,
                @ResHolidayXid
            );
            """;

        var effectiveArrDate = arrDate?.Date
            ?? (await GetArrDateByResHolidayIdAsync(resHolidayId, connection, transaction, cancellationToken)).Date;

        await EnsureGuideIsAvailableAsync(
            guideId,
            effectiveArrDate,
            normalizedShiftCode,
            resHolidayId,
            shiftColumnSql,
            connection,
            transaction,
            cancellationToken);

        var assignmentId = await InsertGuideAssignmentAsync(
            resHolidayId,
            guideId,
            connection,
            transaction,
            insertAssignmentSql,
            cancellationToken);

        await InsertGuideBusyAsync(
            guideId,
            resHolidayId,
            effectiveArrDate,
            normalizedShiftCode,
            PendingBusyStatus,
            connection,
            transaction,
            shiftColumnSql is not null ? BuildInsertGuideBusySqlWithShift(shiftColumnSql) : insertBusySqlWithoutShift,
            shiftColumnSql is not null,
            cancellationToken);

        return new AssignGuideToServiceResponse
        {
            Pid = assignmentId,
            ResHolidayXid = resHolidayId,
            SupplierGuideXid = guideId,
            ArrDate = effectiveArrDate,
            MaCa = normalizedShiftCode,
            BusyStatus = PendingBusyStatus,
            AssignStatus = PendingAssignStatus,
            AssignedBy = assignedBy,
            AssignedDateUtc = DateTime.UtcNow,
            OperatorNote = normalizedOperatorNote
        };
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

    private static async Task RollbackAsync(SqlTransaction transaction)
    {
        if (transaction.Connection is not null)
        {
            await transaction.RollbackAsync(CancellationToken.None);
        }
    }

    private static async Task<int> InsertGuideAssignmentAsync(
        int resHolidayId,
        int guideId,
        SqlConnection connection,
        SqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@ResHolidayXid", SqlDbType.Int).Value = resHolidayId;
        command.Parameters.Add("@SupplierGuideXid", SqlDbType.Int).Value = guideId;
        command.Parameters.Add("@AssignStatus", SqlDbType.Int).Value = PendingAssignStatus;

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is null or DBNull ? 0 : Convert.ToInt32(result);
    }

    private static async Task InsertGuideBusyAsync(
        int guideId,
        int resHolidayId,
        DateTime arrDate,
        string maCa,
        string busyStatus,
        SqlConnection connection,
        SqlTransaction transaction,
        string sql,
        bool hasShiftColumn,
        CancellationToken cancellationToken)
    {
        if (hasShiftColumn)
        {
            foreach (var shiftCode in ExpandShiftCodes(maCa))
            {
                await using var command = new SqlCommand(sql, connection, transaction);
                command.Parameters.Add("@SupplierGuideXid", SqlDbType.Int).Value = guideId;
                command.Parameters.Add("@ArrDate", SqlDbType.Date).Value = arrDate.Date;
                command.Parameters.Add("@MaCa", SqlDbType.VarChar, 10).Value = shiftCode;
                command.Parameters.Add("@Busy", SqlDbType.VarChar, 5).Value = busyStatus;
                command.Parameters.Add("@ResHolidayXid", SqlDbType.Int).Value = resHolidayId;
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            return;
        }

        await using var fallbackCommand = new SqlCommand(sql, connection, transaction);
        fallbackCommand.Parameters.Add("@SupplierGuideXid", SqlDbType.Int).Value = guideId;
        fallbackCommand.Parameters.Add("@ArrDate", SqlDbType.Date).Value = arrDate.Date;
        fallbackCommand.Parameters.Add("@Busy", SqlDbType.VarChar, 5).Value = busyStatus;
        fallbackCommand.Parameters.Add("@ResHolidayXid", SqlDbType.Int).Value = resHolidayId;
        await fallbackCommand.ExecuteNonQueryAsync(cancellationToken);
    }

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

    private static async Task EnsureGuideIsAvailableAsync(
        int guideId,
        DateTime arrDate,
        string maCa,
        int resHolidayId,
        string? shiftColumnSql,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sqlWithoutShift = """
            SELECT TOP (1) COALESCE(gb.ResHolidayXid, 0)
            FROM dbo.M_GuideBusy gb WITH (UPDLOCK, HOLDLOCK)
            WHERE gb.SupplierGuideXid = @GuideId
              AND CAST(gb.[Date] AS date) = @ArrDate
              AND (gb.ResHolidayXid IS NULL OR gb.ResHolidayXid <> @ResHolidayId);
            """;

        var sqlWithShift = BuildEnsureGuideAvailableSqlWithShift(shiftColumnSql);
        await using var command = new SqlCommand(shiftColumnSql is not null ? sqlWithShift : sqlWithoutShift, connection, transaction);
        command.Parameters.Add("@GuideId", SqlDbType.Int).Value = guideId;
        command.Parameters.Add("@ArrDate", SqlDbType.Date).Value = arrDate.Date;
        if (shiftColumnSql is not null)
        {
            command.Parameters.Add("@MaCa", SqlDbType.VarChar, 10).Value = maCa;
            command.Parameters.Add("@AllDayShiftCode", SqlDbType.VarChar, 10).Value = AllDayShiftCode;
        }
        command.Parameters.Add("@ResHolidayId", SqlDbType.Int).Value = resHolidayId;

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (result is not null and not DBNull)
        {
            var conflictingResHolidayId = Convert.ToInt32(result);
            var conflictTarget = conflictingResHolidayId == 0
                ? "a personal busy record"
                : $"service {conflictingResHolidayId}";

            throw new GuideAssignmentConflictException(
                $"Guide {guideId} is already busy on {arrDate:yyyy-MM-dd} ({maCa}) for {conflictTarget}.");
        }
    }

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
            CASE WHEN gb.Pid IS NULL THEN 0 ELSE 1 END AS HasBusyRow
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
            CASE WHEN gb.Pid IS NULL THEN 0 ELSE 1 END AS HasBusyRow
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

    private static string BuildEnsureGuideAvailableSqlWithShift(string? shiftColumnSql) => $"""
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
          AND (gb.ResHolidayXid IS NULL OR gb.ResHolidayXid <> @ResHolidayId);
        """;
}
