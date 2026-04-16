using System.Collections.Concurrent;
using GuideManagement.Api.Models.Timeline;
using Microsoft.Data.SqlClient;

namespace GuideManagement.Api.Services;

public sealed class TimelineRepository(ISqlConnectionFactory connectionFactory) : ITimelineRepository
{
    private static readonly ConcurrentDictionary<string, int> ItemAssignmentOverrides = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, string> ItemTimeSlotOverrides = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, IReadOnlyList<GuideTimeExceptionDto>> GuideTimeExceptionOverrides =
        new(StringComparer.OrdinalIgnoreCase);

    public async Task<TimelineDataDto> GetTimelineAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var (rangeStart, rangeEnd) = NormalizeRange(from, to);
        var bookings = await GetBookingsAsync(rangeStart, rangeEnd, cancellationToken);
        var guides = await GetGuidesAsync(cancellationToken);
        var relations = await GetGuideRelationsAsync(rangeStart, rangeEnd, cancellationToken);

        var guideNameById = guides.ToDictionary(item => item.Id, item => item.Name);

        var assignedGuideIdsByBooking = new Dictionary<string, HashSet<int>>(StringComparer.OrdinalIgnoreCase);
        var confirmedGuideIdsByBooking = new Dictionary<string, HashSet<int>>(StringComparer.OrdinalIgnoreCase);
        var emailRecords = new Dictionary<string, GuideEmailRecordDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var relation in relations)
        {
            if (!assignedGuideIdsByBooking.TryGetValue(relation.BookingId, out var assignedGuideIds))
            {
                assignedGuideIds = [];
                assignedGuideIdsByBooking[relation.BookingId] = assignedGuideIds;
            }

            assignedGuideIds.Add(relation.GuideId);

            if (relation.IsConfirmed)
            {
                if (!confirmedGuideIdsByBooking.TryGetValue(relation.BookingId, out var confirmedGuideIds))
                {
                    confirmedGuideIds = [];
                    confirmedGuideIdsByBooking[relation.BookingId] = confirmedGuideIds;
                }

                confirmedGuideIds.Add(relation.GuideId);
            }

            if (!string.IsNullOrWhiteSpace(relation.Message))
            {
                emailRecords[$"{relation.BookingId}-{relation.GuideId}"] = new GuideEmailRecordDto
                {
                    BookingId = relation.BookingId,
                    GuideId = relation.GuideId,
                    Status = relation.IsConfirmed ? "sent" : "draft",
                    Date = relation.MessageDate,
                    Subject = string.Empty,
                    Body = relation.Message
                };
            }
        }

        var itemAssignments = BuildBaseItemAssignments(bookings, assignedGuideIdsByBooking);
        ApplyItemAssignmentOverrides(itemAssignments);

        var itemTimeSlots = BuildItemTimeSlots(itemAssignments.Keys);
        var guideTimeExceptions = GetGuideTimeExceptionsFromOverrides();

        var bookingsData = bookings
            .Select(booking =>
            {
                var assignedGuideIds = GetAssignedGuideIdsForBooking(itemAssignments, booking.Id).ToHashSet();
                var confirmedGuideIds = confirmedGuideIdsByBooking.TryGetValue(booking.Id, out var confirmed)
                    ? confirmed.Where(assignedGuideIds.Contains).ToHashSet()
                    : [];

                return new TimelineBookingDto
                {
                    Id = booking.Id,
                    Ref = booking.Ref,
                    StartDay = booking.StartDay,
                    Duration = booking.Duration,
                    Client = booking.Client,
                    GroupName = booking.GroupName,
                    TourName = booking.TourName,
                    Status = booking.Status,
                    Country = booking.Country,
                    AssignedGuides = assignedGuideIds
                        .Select(guideId => guideNameById.TryGetValue(guideId, out var guideName) ? guideName : string.Empty)
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .OrderBy(value => value)
                        .ToArray(),
                    ConfirmedGuides = confirmedGuideIds
                        .Select(guideId => guideNameById.TryGetValue(guideId, out var guideName) ? guideName : string.Empty)
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .OrderBy(value => value)
                        .ToArray()
                };
            })
            .ToArray();

        var guideExceptionsByGuide = guideTimeExceptions
            .GroupBy(item => item.GuideId)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<GuideTimeExceptionDto>)group.ToArray());

        var guidesData = guides
            .Select(guide => new TimelineGuideDto
            {
                Id = guide.Id,
                Name = guide.Name,
                Tags = guide.Tags,
                BusyDates = guide.BusyDates,
                TimeExceptions = guideExceptionsByGuide.TryGetValue(guide.Id, out var guideExceptions)
                    ? guideExceptions
                    : []
            })
            .ToArray();

        return new TimelineDataDto
        {
            BookingsData = bookingsData,
            GuidesData = guidesData,
            ItemAssignments = itemAssignments,
            ItemTimeSlots = itemTimeSlots,
            EmailRecords = emailRecords,
            GuideTimeExceptions = guideTimeExceptions
        };
    }

    public async Task<TimelineDataDto> SetBookingGuideConfirmationAsync(BookingGuideConfirmationRequest request, CancellationToken cancellationToken)
    {
        if (!int.TryParse(request.BookingId, out var bookingPid))
        {
            return await GetTimelineAsync(null, null, cancellationToken);
        }

        var guideId = await GetGuideIdByNameAsync(request.GuideName, cancellationToken);
        if (!guideId.HasValue)
        {
            return await GetTimelineAsync(null, null, cancellationToken);
        }

        const string sql = """
            MERGE dbo.Res_HolidayGuide AS target
            USING (SELECT @BookingPid AS ResHolidayXid, @GuideId AS SupplierGuideXid) AS source
            ON target.ResHolidayXid = source.ResHolidayXid AND target.SupplierGuideXid = source.SupplierGuideXid
            WHEN MATCHED THEN
                UPDATE SET
                    SendSMS = @SendSMS,
                    SendSMSDate = @SendSMSDate,
                    LastEdit = GETDATE(),
                    LastEditByXid = 0
            WHEN NOT MATCHED THEN
                INSERT (SupplierGuideXid, ResHolidayXid, Dated, SendSMS, SendSMSDate, LastEdit, LastEditByXid)
                VALUES (source.SupplierGuideXid, source.ResHolidayXid, GETDATE(), @SendSMS, @SendSMSDate, GETDATE(), 0);
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@BookingPid", bookingPid);
        command.Parameters.AddWithValue("@GuideId", guideId.Value);
        command.Parameters.AddWithValue("@SendSMS", request.Confirmed ? "Y" : "N");
        command.Parameters.AddWithValue("@SendSMSDate", request.Confirmed ? DateTime.UtcNow : (object)DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);

        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> AddGuideBusyDateAsync(GuideBusyDateRequest request, CancellationToken cancellationToken)
    {
        if (!request.From.HasValue || !request.To.HasValue)
        {
            return await GetTimelineAsync(null, null, cancellationToken);
        }

        var currentDate = request.From.Value;
        while (currentDate <= request.To.Value)
        {
            await InsertBusyDateAsync(request.GuideId, currentDate, cancellationToken);
            currentDate = currentDate.AddDays(1);
        }

        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> RemoveGuideBusyDateAsync(int guideId, string busyDateId, CancellationToken cancellationToken)
    {
        var pid = ParseBusyPid(busyDateId);
        if (!pid.HasValue)
        {
            return await GetTimelineAsync(null, null, cancellationToken);
        }

        const string sql = """
            DELETE FROM dbo.M_GuideBusy
            WHERE Pid = @Pid AND SupplierGuideXid = @GuideId;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@Pid", pid.Value);
        command.Parameters.AddWithValue("@GuideId", guideId);
        await command.ExecuteNonQueryAsync(cancellationToken);

        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> SetBookingItemTimeSlotAsync(BookingItemTimeSlotRequest request, CancellationToken cancellationToken)
    {
        ItemTimeSlotOverrides[request.ItemId] = request.Slot;
        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> AssignBookingItemsAsync(AssignBookingItemsRequest request, CancellationToken cancellationToken)
    {
        foreach (var itemId in request.ItemIds.Where(itemId => itemId.StartsWith($"{request.BookingId}-", StringComparison.OrdinalIgnoreCase)))
        {
            ItemAssignmentOverrides[itemId] = request.GuideId;
            ItemTimeSlotOverrides.TryAdd(itemId, "full-day");
        }

        if (int.TryParse(request.BookingId, out var bookingPid))
        {
            await EnsureGuideRelationAsync(bookingPid, request.GuideId, cancellationToken);
            await SetPrimaryGuideAsync(bookingPid, request.GuideId, cancellationToken);
        }

        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> UnassignBookingItemsAsync(UnassignBookingItemsRequest request, CancellationToken cancellationToken)
    {
        foreach (var itemId in request.ItemIds.Where(itemId => itemId.StartsWith($"{request.BookingId}-", StringComparison.OrdinalIgnoreCase)))
        {
            ItemAssignmentOverrides[itemId] = 0;
        }

        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> UnassignGuideFromBookingAsync(string bookingId, string guideName, CancellationToken cancellationToken)
    {
        var guideId = await GetGuideIdByNameAsync(guideName, cancellationToken);
        if (!guideId.HasValue || !int.TryParse(bookingId, out var bookingPid))
        {
            return await GetTimelineAsync(null, null, cancellationToken);
        }

        const string deleteRelationSql = """
            DELETE FROM dbo.Res_HolidayGuide
            WHERE ResHolidayXid = @BookingPid AND SupplierGuideXid = @GuideId;
            """;

        const string resetPrimarySql = """
            UPDATE dbo.Res_Holidays
            SET GuideXid = NULL
            WHERE Pid = @BookingPid AND GuideXid = @GuideId;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using (var deleteRelationCommand = new SqlCommand(deleteRelationSql, connection))
        {
            deleteRelationCommand.Parameters.AddWithValue("@BookingPid", bookingPid);
            deleteRelationCommand.Parameters.AddWithValue("@GuideId", guideId.Value);
            await deleteRelationCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var resetPrimaryCommand = new SqlCommand(resetPrimarySql, connection))
        {
            resetPrimaryCommand.Parameters.AddWithValue("@BookingPid", bookingPid);
            resetPrimaryCommand.Parameters.AddWithValue("@GuideId", guideId.Value);
            await resetPrimaryCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        var timeline = await GetTimelineAsync(null, null, cancellationToken);
        foreach (var key in timeline.ItemAssignments
                     .Where(entry => entry.Key.StartsWith($"{bookingId}-", StringComparison.OrdinalIgnoreCase) && entry.Value == guideId.Value)
                     .Select(entry => entry.Key))
        {
            ItemAssignmentOverrides[key] = 0;
        }

        GuideTimeExceptionOverrides.TryRemove($"{bookingId}-{guideId.Value}", out _);

        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> SetGuideEmailRecordAsync(GuideEmailRecordUpsertRequest request, CancellationToken cancellationToken)
    {
        if (!int.TryParse(request.BookingId, out var bookingPid))
        {
            return await GetTimelineAsync(null, null, cancellationToken);
        }

        const string sql = """
            MERGE dbo.Res_HolidayGuide AS target
            USING (SELECT @BookingPid AS ResHolidayXid, @GuideId AS SupplierGuideXid) AS source
            ON target.ResHolidayXid = source.ResHolidayXid AND target.SupplierGuideXid = source.SupplierGuideXid
            WHEN MATCHED THEN
                UPDATE SET
                    Message = @Message,
                    SendSMS = @SendSMS,
                    SendSMSDate = @SendSMSDate,
                    LastEdit = GETDATE(),
                    LastEditByXid = 0
            WHEN NOT MATCHED THEN
                INSERT (SupplierGuideXid, ResHolidayXid, Dated, Message, SendSMS, SendSMSDate, LastEdit, LastEditByXid)
                VALUES (source.SupplierGuideXid, source.ResHolidayXid, GETDATE(), @Message, @SendSMS, @SendSMSDate, GETDATE(), 0);
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@BookingPid", bookingPid);
        command.Parameters.AddWithValue("@GuideId", request.GuideId);
        command.Parameters.AddWithValue("@Message", request.Body ?? string.Empty);
        command.Parameters.AddWithValue("@SendSMS", string.Equals(request.Status, "sent", StringComparison.OrdinalIgnoreCase) ? "Y" : "N");
        command.Parameters.AddWithValue("@SendSMSDate", request.Date?.ToDateTime(TimeOnly.MinValue) ?? (object)DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);

        return await GetTimelineAsync(null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> SetGuideBookingTimeExceptionsAsync(GuideTimeExceptionsUpsertRequest request, CancellationToken cancellationToken)
    {
        var key = $"{request.BookingId}-{request.GuideId}";
        var entries = request.Entries
            .Where(entry => entry.Date.HasValue && entry.StartHour < entry.EndHour)
            .Select(entry => new GuideTimeExceptionDto
            {
                Id = $"gte-{request.BookingId}-{request.GuideId}-{entry.Date:yyyy-MM-dd}",
                BookingId = request.BookingId,
                GuideId = request.GuideId,
                Date = entry.Date,
                StartHour = entry.StartHour,
                EndHour = entry.EndHour
            })
            .ToArray();

        GuideTimeExceptionOverrides[key] = entries;
        return await GetTimelineAsync(null, null, cancellationToken);
    }

    private async Task<IReadOnlyList<TimelineBookingDto>> GetBookingsAsync(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (400)
                rh.Pid,
                rh.RefId,
                rh.SubResNo,
                rh.ArrDate,
                rh.NoOfNights,
                rh.PartyName,
                rh.ServiceName,
                rh.StatusXid,
                rh.CountryXid,
                rh.Holiday
            FROM dbo.Res_Holidays rh
            WHERE rh.ArrDate IS NOT NULL
              AND rh.ArrDate <= @RangeEnd
              AND DATEADD(day, CASE WHEN ISNULL(rh.NoOfNights, 1) < 1 THEN 1 ELSE rh.NoOfNights END, rh.ArrDate) >= @RangeStart
            ORDER BY rh.ArrDate, rh.Pid;
            """;

        var result = new List<TimelineBookingDto>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@RangeStart", rangeStart.ToDateTime(TimeOnly.MinValue));
        command.Parameters.AddWithValue("@RangeEnd", rangeEnd.ToDateTime(TimeOnly.MinValue));
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var pid = reader.GetInt32(0);
            var refId = reader.IsDBNull(1) ? string.Empty : reader.GetInt32(1).ToString();
            var subResNo = reader.IsDBNull(2) ? string.Empty : reader.GetString(2);
            var noOfNights = reader.IsDBNull(4) ? 1 : reader.GetInt32(4);
            var serviceName = reader.IsDBNull(6) ? string.Empty : reader.GetString(6);
            var holiday = reader.IsDBNull(9) ? string.Empty : reader.GetString(9);

            result.Add(new TimelineBookingDto
            {
                Id = pid.ToString(),
                Ref = string.IsNullOrWhiteSpace(refId)
                    ? (string.IsNullOrWhiteSpace(subResNo) ? $"BOOKING-{pid}" : subResNo)
                    : string.IsNullOrWhiteSpace(subResNo) ? refId : $"{refId} - {subResNo}",
                StartDay = reader.IsDBNull(3) ? null : DateOnly.FromDateTime(reader.GetDateTime(3)),
                Duration = Math.Max(1, noOfNights),
                Client = reader.IsDBNull(5) ? string.Empty : reader.GetString(5),
                GroupName = string.IsNullOrWhiteSpace(subResNo)
                    ? (reader.IsDBNull(5) ? string.Empty : reader.GetString(5))
                    : subResNo,
                TourName = !string.IsNullOrWhiteSpace(serviceName) ? serviceName : holiday,
                Status = MapBookingStatus(reader.IsDBNull(7) ? (int?)null : reader.GetInt32(7)),
                Country = reader.IsDBNull(8) ? string.Empty : $"Country {reader.GetInt32(8)}",
                AssignedGuides = [],
                ConfirmedGuides = []
            });
        }

        return result;
    }

    private async Task<IReadOnlyList<TimelineGuideDto>> GetGuidesAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                g.Pid,
                g.Guide,
                g.ExactCode
            FROM dbo.M_SupplierGuide g
            ORDER BY g.Guide;
            """;

        var busyDatesByGuide = await GetGuideBusyDatesMapAsync(cancellationToken);
        var result = new List<TimelineGuideDto>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var guideId = reader.GetInt32(0);
            var exactCode = reader.IsDBNull(2) ? string.Empty : reader.GetString(2).Trim();

            result.Add(new TimelineGuideDto
            {
                Id = guideId,
                Name = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                Tags = string.IsNullOrWhiteSpace(exactCode) ? [] : [exactCode],
                BusyDates = busyDatesByGuide.TryGetValue(guideId, out var busyDates) ? busyDates : [],
                TimeExceptions = []
            });
        }

        return result;
    }

    private async Task<IReadOnlyList<GuideRelation>> GetGuideRelationsAsync(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                CAST(rh.Pid AS varchar(20)) AS BookingId,
                rh.GuideXid,
                CAST(NULL AS char(1)) AS SendSMS,
                CAST(NULL AS nvarchar(MAX)) AS Message,
                CAST(NULL AS datetime) AS SendSMSDate
            FROM dbo.Res_Holidays rh
            WHERE rh.GuideXid IS NOT NULL
              AND rh.ArrDate IS NOT NULL
              AND rh.ArrDate <= @RangeEnd
              AND DATEADD(day, CASE WHEN ISNULL(rh.NoOfNights, 1) < 1 THEN 1 ELSE rh.NoOfNights END, rh.ArrDate) >= @RangeStart

            UNION ALL

            SELECT
                CAST(hg.ResHolidayXid AS varchar(20)) AS BookingId,
                hg.SupplierGuideXid,
                hg.SendSMS,
                hg.Message,
                hg.SendSMSDate
            FROM dbo.Res_HolidayGuide hg
            INNER JOIN dbo.Res_Holidays rh ON rh.Pid = hg.ResHolidayXid
            WHERE hg.SupplierGuideXid IS NOT NULL
              AND hg.ResHolidayXid IS NOT NULL
              AND rh.ArrDate IS NOT NULL
              AND rh.ArrDate <= @RangeEnd
              AND DATEADD(day, CASE WHEN ISNULL(rh.NoOfNights, 1) < 1 THEN 1 ELSE rh.NoOfNights END, rh.ArrDate) >= @RangeStart;
            """;

        var result = new List<GuideRelation>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@RangeStart", rangeStart.ToDateTime(TimeOnly.MinValue));
        command.Parameters.AddWithValue("@RangeEnd", rangeEnd.ToDateTime(TimeOnly.MinValue));
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new GuideRelation(
                reader.GetString(0),
                reader.GetInt32(1),
                IsConfirmed(reader.IsDBNull(2) ? string.Empty : reader.GetString(2)),
                reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                reader.IsDBNull(4) ? null : DateOnly.FromDateTime(reader.GetDateTime(4))));
        }

        return result;
    }

    private async Task<Dictionary<int, IReadOnlyList<BusyDateDto>>> GetGuideBusyDatesMapAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                gb.Pid,
                gb.SupplierGuideXid,
                gb.[Date],
                gb.Busy
            FROM dbo.M_GuideBusy gb;
            """;

        var result = new Dictionary<int, List<BusyDateDto>>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var busyFlag = reader.IsDBNull(3) ? string.Empty : reader.GetString(3);
            if (!IsConfirmed(busyFlag))
            {
                continue;
            }

            var guideId = reader.GetInt32(1);
            if (!result.TryGetValue(guideId, out var busyDates))
            {
                busyDates = [];
                result[guideId] = busyDates;
            }

            var date = DateOnly.FromDateTime(reader.GetDateTime(2));
            busyDates.Add(new BusyDateDto
            {
                Id = $"busy-{reader.GetInt32(0)}",
                From = date,
                To = date
            });
        }

        return result.ToDictionary(pair => pair.Key, pair => (IReadOnlyList<BusyDateDto>)pair.Value);
    }

    private static Dictionary<string, int> BuildBaseItemAssignments(
        IReadOnlyList<TimelineBookingDto> bookings,
        IReadOnlyDictionary<string, HashSet<int>> assignedGuideIdsByBooking)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var booking in bookings)
        {
            if (!assignedGuideIdsByBooking.TryGetValue(booking.Id, out var guideIds) || guideIds.Count == 0)
            {
                continue;
            }

            var itemIds = GetBookingItemIds(booking.Id, booking.Duration);
            var orderedGuideIds = guideIds.OrderBy(value => value).ToArray();

            for (var index = 0; index < itemIds.Count; index += 1)
            {
                var assignedGuideId = orderedGuideIds[index % orderedGuideIds.Length];
                result[itemIds[index]] = assignedGuideId;
            }
        }

        return result;
    }

    private static void ApplyItemAssignmentOverrides(IDictionary<string, int> itemAssignments)
    {
        foreach (var overrideEntry in ItemAssignmentOverrides)
        {
            if (overrideEntry.Value <= 0)
            {
                itemAssignments.Remove(overrideEntry.Key);
                continue;
            }

            itemAssignments[overrideEntry.Key] = overrideEntry.Value;
        }
    }

    private static IReadOnlyDictionary<string, string> BuildItemTimeSlots(IEnumerable<string> itemIds)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var itemId in itemIds)
        {
            result[itemId] = "full-day";
        }

        foreach (var overrideEntry in ItemTimeSlotOverrides)
        {
            result[overrideEntry.Key] = overrideEntry.Value;
        }

        return result;
    }

    private static IReadOnlyList<int> GetAssignedGuideIdsForBooking(IReadOnlyDictionary<string, int> itemAssignments, string bookingId)
    {
        return itemAssignments
            .Where(entry => entry.Key.StartsWith($"{bookingId}-", StringComparison.OrdinalIgnoreCase))
            .Select(entry => entry.Value)
            .Distinct()
            .ToArray();
    }

    private static IReadOnlyList<string> GetBookingItemIds(string bookingId, int duration)
    {
        var itemIds = new List<string>();
        var normalizedDuration = Math.Max(1, duration);

        for (var day = 1; day <= normalizedDuration; day += 1)
        {
            itemIds.Add($"{bookingId}-d{day}-hd");
            itemIds.Add($"{bookingId}-d{day}-lunch");

            if (day != normalizedDuration)
            {
                itemIds.Add($"{bookingId}-d{day}-dinner");
            }

            if (day == 1 || day == normalizedDuration)
            {
                itemIds.Add($"{bookingId}-d{day}-trf");
            }
        }

        return itemIds;
    }

    private static IReadOnlyList<GuideTimeExceptionDto> GetGuideTimeExceptionsFromOverrides()
    {
        return GuideTimeExceptionOverrides
            .SelectMany(entry => entry.Value)
            .ToArray();
    }

    private async Task InsertBusyDateAsync(int guideId, DateOnly date, CancellationToken cancellationToken)
    {
        const string nextPidSql = "SELECT ISNULL(MAX(Pid), 0) + 1 FROM dbo.M_GuideBusy;";
        const string insertSql = """
            INSERT INTO dbo.M_GuideBusy
            (
                Pid,
                SupplierGuideXid,
                [Date],
                Busy,
                Message,
                LastEdit,
                LastEditByXid,
                Comment
            )
            VALUES
            (
                @Pid,
                @GuideId,
                @Date,
                'Y',
                '',
                GETDATE(),
                0,
                ''
            );
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var nextPidCommand = new SqlCommand(nextPidSql, connection);
        var nextPid = Convert.ToInt32(await nextPidCommand.ExecuteScalarAsync(cancellationToken));

        await using var insertCommand = new SqlCommand(insertSql, connection);
        insertCommand.Parameters.AddWithValue("@Pid", nextPid);
        insertCommand.Parameters.AddWithValue("@GuideId", guideId);
        insertCommand.Parameters.AddWithValue("@Date", date.ToDateTime(TimeOnly.MinValue));
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task EnsureGuideRelationAsync(int bookingPid, int guideId, CancellationToken cancellationToken)
    {
        const string sql = """
            MERGE dbo.Res_HolidayGuide AS target
            USING (SELECT @BookingPid AS ResHolidayXid, @GuideId AS SupplierGuideXid) AS source
            ON target.ResHolidayXid = source.ResHolidayXid AND target.SupplierGuideXid = source.SupplierGuideXid
            WHEN NOT MATCHED THEN
                INSERT (SupplierGuideXid, ResHolidayXid, Dated, SendSMS, LastEdit, LastEditByXid)
                VALUES (source.SupplierGuideXid, source.ResHolidayXid, GETDATE(), 'N', GETDATE(), 0);
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@BookingPid", bookingPid);
        command.Parameters.AddWithValue("@GuideId", guideId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task SetPrimaryGuideAsync(int bookingPid, int guideId, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE dbo.Res_Holidays
            SET GuideXid = @GuideId
            WHERE Pid = @BookingPid;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@GuideId", guideId);
        command.Parameters.AddWithValue("@BookingPid", bookingPid);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<int?> GetGuideIdByNameAsync(string guideName, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP(1) g.Pid
            FROM dbo.M_SupplierGuide g
            WHERE g.Guide = @GuideName;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@GuideName", guideName);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is null || result == DBNull.Value ? null : Convert.ToInt32(result);
    }

    private static int? ParseBusyPid(string busyDateId)
    {
        if (!busyDateId.StartsWith("busy-", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var raw = busyDateId[5..];
        return int.TryParse(raw, out var pid) ? pid : null;
    }

    private static string MapBookingStatus(int? statusXid)
    {
        if (!statusXid.HasValue)
        {
            return "Requested";
        }

        return statusXid.Value switch
        {
            0 => "Requested",
            1 => "Confirmed",
            2 => "Cancelled",
            3 => "Paid",
            _ => $"Status {statusXid.Value}"
        };
    }

    private static bool IsConfirmed(string flag)
    {
        var normalized = flag.Trim().ToUpperInvariant();
        return normalized is "Y" or "1" or "T";
    }

    private sealed record GuideRelation(
        string BookingId,
        int GuideId,
        bool IsConfirmed,
        string Message,
        DateOnly? MessageDate);

    private static (DateOnly Start, DateOnly End) NormalizeRange(DateOnly? from, DateOnly? to)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = from ?? today.AddDays(-120);
        var end = to ?? today.AddDays(400);

        if (start > end)
        {
            (start, end) = (end, start);
        }

        return (start, end);
    }
}
