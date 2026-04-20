using Dapper;
using GuideManagement.Api.Models.Timeline;

namespace GuideManagement.Api.Services;

public sealed class TimelineRepository(
    ISqlConnectionFactory connectionFactory,
    IBookingManagementState bookingManagementState) : ITimelineRepository
{
    private const int BookingSeriesPageSize = 10;

    public async Task<TimelineDataDto> GetTimelineAsync(
        DateOnly? from,
        DateOnly? to,
        int? countryXid,
        string? search,
        string? client,
        string? country,
        string? guide,
        string? series,
        string? loadSeries,
        int? seriesSkip,
        int? seriesTake,
        CancellationToken cancellationToken)
    {
        var (rangeStart, rangeEnd) = NormalizeRange(from, to);
        var bookings = await GetBookingsAsync(rangeStart, rangeEnd, cancellationToken);
        var guides = await GetGuidesAsync(countryXid, cancellationToken);
        var relations = await GetGuideRelationsAsync(rangeStart, rangeEnd, countryXid, cancellationToken);

        return BuildTimelineData(
            bookings,
            guides,
            relations,
            countryXid.HasValue,
            search,
            client,
            country,
            guide,
            series,
            loadSeries,
            seriesSkip,
            seriesTake);
    }

    private TimelineDataDto BuildTimelineData(
        IReadOnlyList<TimelineBookingDto> bookings,
        IReadOnlyList<TimelineGuideDto> guides,
        IReadOnlyList<GuideRelation> relations,
        bool restrictToBookingsWithAssignedGuides,
        string? search,
        string? client,
        string? country,
        string? guide,
        string? series,
        string? loadSeries,
        int? seriesSkip,
        int? seriesTake)
    {
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

        var bookingsForTimeline = restrictToBookingsWithAssignedGuides
            ? bookings.Where(booking => assignedGuideIdsByBooking.ContainsKey(booking.Id)).ToArray()
            : bookings;

        var itemManagedBookingIds = bookingManagementState.ItemManagedBookingIds.Keys.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var itemAssignments = BuildBaseItemAssignments(bookingsForTimeline, assignedGuideIdsByBooking, itemManagedBookingIds);
        ApplyItemAssignmentOverrides(itemAssignments);

        var itemTimeSlots = BuildItemTimeSlots(itemAssignments.Keys);
        var guideTimeExceptions = GetGuideTimeExceptionsFromOverrides();

        var filteredBookings = bookingsForTimeline
            .Select(booking =>
            {
                var assignedGuideIds = GetAssignedGuideIdsForBooking(itemAssignments, booking.Id).ToHashSet();
                var confirmedGuideIds = confirmedGuideIdsByBooking.TryGetValue(booking.Id, out var confirmed)
                    ? confirmed.Where(assignedGuideIds.Contains).ToHashSet()
                    : [];

                return new TimelineBookingDto
                {
                    Id = booking.Id,
                    Series = booking.Series,
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
            .Where(booking => MatchesBookingFilters(booking, search, client, country, guide, series))
            .ToArray();

        var bookingsBySeries = filteredBookings
            .GroupBy(booking => string.IsNullOrWhiteSpace(booking.Series) ? "NO SERIES" : booking.Series)
            .ToDictionary(group => group.Key, group => group.OrderBy(booking => booking.StartDay).ToArray());

        var bookingSeries = bookingsBySeries
            .Select(group =>
            {
                var items = group.Value;
                var total = items.Length;
                var assigned = items.Count(item => item.AssignedGuides.Count > 0);
                return new TimelineBookingSeriesDto
                {
                    Series = group.Key,
                    Total = total,
                    Assigned = assigned,
                    NotAssigned = total - assigned,
                    Cancelled = items.Count(item => item.Status.Contains("cancel", StringComparison.OrdinalIgnoreCase)),
                    OnRequest = items.Count(item => item.Status.Contains("request", StringComparison.OrdinalIgnoreCase)),
                    Confirmed = items.Count(item =>
                        item.Status.Equals("confirmed", StringComparison.OrdinalIgnoreCase) ||
                        item.Status.Equals("paid", StringComparison.OrdinalIgnoreCase) ||
                        item.Status.Equals("book", StringComparison.OrdinalIgnoreCase) ||
                        item.Status.Equals("booked", StringComparison.OrdinalIgnoreCase))
                };
            })
            .OrderBy(item => item.Series)
            .ToArray();

        IReadOnlyList<TimelineBookingDto> bookingsData;
        if (!string.IsNullOrWhiteSpace(loadSeries))
        {
            var normalizedSeries = loadSeries.Trim();
            var skip = Math.Max(0, seriesSkip ?? 0);
            var take = Math.Max(1, seriesTake ?? BookingSeriesPageSize);
            bookingsData = bookingsBySeries.TryGetValue(normalizedSeries, out var seriesBookings)
                ? seriesBookings.Skip(skip).Take(take).ToArray()
                : [];
        }
        else
        {
            var take = Math.Max(1, seriesTake ?? BookingSeriesPageSize);
            bookingsData = bookingSeries
                .SelectMany(seriesMeta => bookingsBySeries.TryGetValue(seriesMeta.Series, out var seriesBookings)
                    ? seriesBookings.Take(take)
                    : [])
                .ToArray();
        }

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
            BookingSeries = bookingSeries,
            GuidesData = guidesData,
            ItemAssignments = itemAssignments,
            ItemTimeSlots = itemTimeSlots,
            EmailRecords = emailRecords,
            GuideTimeExceptions = guideTimeExceptions
        };
    }

    public async Task<TimelineDataDto> SetBookingGuideConfirmationAsync(
        BookingGuideConfirmationRequest request,
        CancellationToken cancellationToken)
    {
        if (!int.TryParse(request.BookingId, out var bookingPid))
        {
            return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
        }

        var guideId = await GetGuideIdByNameAsync(request.GuideName, cancellationToken);
        if (!guideId.HasValue)
        {
            return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
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
        await connection.ExecuteAsync(
            new CommandDefinition(
                sql,
                new
                {
                    BookingPid = bookingPid,
                    GuideId = guideId.Value,
                    SendSMS = request.Confirmed ? "Y" : "N",
                    SendSMSDate = request.Confirmed ? (DateTime?)DateTime.UtcNow : null
                },
                cancellationToken: cancellationToken));

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> AddGuideBusyDateAsync(GuideBusyDateRequest request, CancellationToken cancellationToken)
    {
        if (!request.From.HasValue || !request.To.HasValue)
        {
            return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
        }

        var currentDate = request.From.Value;
        while (currentDate <= request.To.Value)
        {
            await InsertBusyDateAsync(request.GuideId, currentDate, cancellationToken);
            currentDate = currentDate.AddDays(1);
        }

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> RemoveGuideBusyDateAsync(int guideId, string busyDateId, CancellationToken cancellationToken)
    {
        var pid = ParseBusyPid(busyDateId);
        if (!pid.HasValue)
        {
            return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
        }

        const string sql = """
            DELETE FROM dbo.M_GuideBusy
            WHERE Pid = @Pid AND SupplierGuideXid = @GuideId;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await connection.ExecuteAsync(
            new CommandDefinition(
                sql,
                new
                {
                    Pid = pid.Value,
                    GuideId = guideId
                },
                cancellationToken: cancellationToken));

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> SetBookingItemTimeSlotAsync(BookingItemTimeSlotRequest request, CancellationToken cancellationToken)
    {
        bookingManagementState.ItemTimeSlotOverrides[request.ItemId] = request.Slot;
        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> AssignBookingItemsAsync(AssignBookingItemsRequest request, CancellationToken cancellationToken)
    {
        bookingManagementState.ItemManagedBookingIds[request.BookingId] = 1;

        foreach (var itemId in request.ItemIds.Where(itemId => itemId.StartsWith($"{request.BookingId}-", StringComparison.OrdinalIgnoreCase)))
        {
            bookingManagementState.ItemAssignmentOverrides[itemId] = request.GuideId;
            bookingManagementState.ItemTimeSlotOverrides.TryAdd(itemId, "full-day");
        }

        if (int.TryParse(request.BookingId, out var bookingPid))
        {
            await EnsureGuideRelationAsync(bookingPid, request.GuideId, cancellationToken);
        }

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> UnassignBookingItemsAsync(UnassignBookingItemsRequest request, CancellationToken cancellationToken)
    {
        bookingManagementState.ItemManagedBookingIds[request.BookingId] = 1;

        foreach (var itemId in request.ItemIds.Where(itemId => itemId.StartsWith($"{request.BookingId}-", StringComparison.OrdinalIgnoreCase)))
        {
            bookingManagementState.ItemAssignmentOverrides[itemId] = 0;
        }

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> UnassignGuideFromBookingAsync(
        string bookingId,
        string guideName,
        CancellationToken cancellationToken)
    {
        var guideId = await GetGuideIdByNameAsync(guideName, cancellationToken);
        if (!guideId.HasValue || !int.TryParse(bookingId, out var bookingPid))
        {
            return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
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
        await connection.ExecuteAsync(
            new CommandDefinition(
                deleteRelationSql,
                new
                {
                    BookingPid = bookingPid,
                    GuideId = guideId.Value
                },
                cancellationToken: cancellationToken));
        await connection.ExecuteAsync(
            new CommandDefinition(
                resetPrimarySql,
                new
                {
                    BookingPid = bookingPid,
                    GuideId = guideId.Value
                },
                cancellationToken: cancellationToken));

        var timeline = await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
        bookingManagementState.ItemManagedBookingIds[bookingId] = 1;
        foreach (var key in timeline.ItemAssignments
                     .Where(entry => entry.Key.StartsWith($"{bookingId}-", StringComparison.OrdinalIgnoreCase) && entry.Value == guideId.Value)
                     .Select(entry => entry.Key))
        {
            bookingManagementState.ItemAssignmentOverrides[key] = 0;
        }

        bookingManagementState.GuideTimeExceptionOverrides.TryRemove($"{bookingId}-{guideId.Value}", out _);

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> SetGuideEmailRecordAsync(
        GuideEmailRecordUpsertRequest request,
        CancellationToken cancellationToken)
    {
        if (!int.TryParse(request.BookingId, out var bookingPid))
        {
            return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
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
        await connection.ExecuteAsync(
            new CommandDefinition(
                sql,
                new
                {
                    BookingPid = bookingPid,
                    GuideId = request.GuideId,
                    Message = request.Body ?? string.Empty,
                    SendSMS = string.Equals(request.Status, "sent", StringComparison.OrdinalIgnoreCase) ? "Y" : "N",
                    SendSMSDate = request.Date?.ToDateTime(TimeOnly.MinValue)
                },
                cancellationToken: cancellationToken));

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    public async Task<TimelineDataDto> SetGuideBookingTimeExceptionsAsync(
        GuideTimeExceptionsUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var key = $"{request.BookingId}-{request.GuideId}";
        var entries = request.Entries
            .Where(entry => entry.Date.HasValue && entry.StartHour < entry.EndHour)
            .Select(entry => new GuideTimeExceptionOverrideEntry(
                $"gte-{request.BookingId}-{request.GuideId}-{entry.Date:yyyy-MM-dd}",
                request.BookingId,
                request.GuideId,
                entry.Date,
                entry.StartHour,
                entry.EndHour))
            .ToArray();

        if (entries.Length == 0)
        {
            bookingManagementState.GuideTimeExceptionOverrides.TryRemove(key, out _);
        }
        else
        {
            bookingManagementState.GuideTimeExceptionOverrides[key] = entries;
        }

        return await GetTimelineAsync(null, null, null, null, null, null, null, null, null, null, null, cancellationToken);
    }

    private async Task<IReadOnlyList<TimelineBookingDto>> GetBookingsAsync(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                rh.Pid AS Id,
                CAST(rh.RefId AS nvarchar(50)) AS RefId,
                CAST(rh.SubResNo AS nvarchar(50)) AS SubResNo,
                rh.ArrDate AS StartDay,
                CASE WHEN ISNULL(rh.NoOfNights, 1) < 1 THEN 1 ELSE rh.NoOfNights END AS Duration,
                CAST(ISNULL(rh.PartyName, '') AS nvarchar(255)) AS Client,
                CAST(ISNULL(rh.ServiceName, '') AS nvarchar(255)) AS ServiceName,
                rh.StatusXid,
                rh.CountryXid,
                CAST(ISNULL(rh.Holiday, '') AS nvarchar(255)) AS Holiday,
                LTRIM(RTRIM(ISNULL(mc.Country, ''))) AS Country
            FROM dbo.Res_Holidays rh
            LEFT JOIN dbo.M_Country mc ON mc.Pid = rh.CountryXid
            WHERE rh.ArrDate IS NOT NULL
              AND rh.ArrDate <= @RangeEnd
              AND DATEADD(day, CASE WHEN ISNULL(rh.NoOfNights, 1) < 1 THEN 1 ELSE rh.NoOfNights END, rh.ArrDate) >= @RangeStart
            ORDER BY rh.ArrDate, rh.Pid;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<TimelineBookingRow>(
            new CommandDefinition(
                sql,
                new
                {
                    RangeStart = rangeStart.ToDateTime(TimeOnly.MinValue),
                    RangeEnd = rangeEnd.ToDateTime(TimeOnly.MinValue)
                },
                cancellationToken: cancellationToken));

        return rows.Select(row =>
        {
            var subResNo = row.SubResNo?.Trim() ?? string.Empty;
            var refId = row.RefId?.Trim() ?? string.Empty;
            var groupName = string.IsNullOrWhiteSpace(subResNo)
                ? row.Client ?? string.Empty
                : subResNo;

            return new TimelineBookingDto
            {
                Id = row.Id.ToString(),
                Series = DeriveSeriesFromGroupName(groupName),
                Ref = string.IsNullOrWhiteSpace(refId)
                    ? (string.IsNullOrWhiteSpace(subResNo) ? $"BOOKING-{row.Id}" : subResNo)
                    : string.IsNullOrWhiteSpace(subResNo) ? refId : $"{refId} - {subResNo}",
                StartDay = row.StartDay is null ? null : DateOnly.FromDateTime(row.StartDay.Value),
                Duration = Math.Max(1, row.Duration),
                Client = row.Client ?? string.Empty,
                GroupName = groupName,
                TourName = !string.IsNullOrWhiteSpace(row.ServiceName) ? row.ServiceName : row.Holiday ?? string.Empty,
                Status = MapBookingStatus(row.StatusXid),
                Country = !string.IsNullOrWhiteSpace(row.Country)
                    ? row.Country
                    : row.CountryXid.HasValue ? $"Country {row.CountryXid.Value}" : string.Empty,
                AssignedGuides = [],
                ConfirmedGuides = []
            };
        }).ToArray();
    }

    private async Task<IReadOnlyList<TimelineGuideDto>> GetGuidesAsync(int? countryXid, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                g.Pid AS Id,
                CAST(ISNULL(g.Guide, '') AS nvarchar(255)) AS Name,
                LTRIM(RTRIM(ISNULL(g.ExactCode, ''))) AS ExactCode
            FROM dbo.M_SupplierGuide g
            WHERE @CountryXid IS NULL OR g.CountryXid = @CountryXid
            ORDER BY g.Guide;
            """;

        var busyDatesByGuide = await GetGuideBusyDatesMapAsync(cancellationToken);

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<GuideRow>(
            new CommandDefinition(
                sql,
                new { CountryXid = countryXid },
                cancellationToken: cancellationToken));

        return rows.Select(row => new TimelineGuideDto
        {
            Id = row.Id,
            Name = row.Name,
            Tags = string.IsNullOrWhiteSpace(row.ExactCode) ? [] : [row.ExactCode],
            BusyDates = busyDatesByGuide.TryGetValue(row.Id, out var busyDates) ? busyDates : [],
            TimeExceptions = []
        }).ToArray();
    }

    private async Task<IReadOnlyList<GuideRelation>> GetGuideRelationsAsync(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        int? countryXid,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                CAST(rh.Pid AS varchar(20)) AS BookingId,
                rh.GuideXid AS GuideId,
                CAST(NULL AS char(1)) AS SendSMS,
                CAST(NULL AS nvarchar(MAX)) AS Message,
                CAST(NULL AS datetime) AS SendSMSDate
            FROM dbo.Res_Holidays rh
            INNER JOIN dbo.M_SupplierGuide g ON g.Pid = rh.GuideXid
            WHERE rh.GuideXid IS NOT NULL
              AND (@CountryXid IS NULL OR g.CountryXid = @CountryXid)
              AND rh.ArrDate IS NOT NULL
              AND rh.ArrDate <= @RangeEnd
              AND DATEADD(day, CASE WHEN ISNULL(rh.NoOfNights, 1) < 1 THEN 1 ELSE rh.NoOfNights END, rh.ArrDate) >= @RangeStart

            UNION ALL

            SELECT
                CAST(hg.ResHolidayXid AS varchar(20)) AS BookingId,
                hg.SupplierGuideXid AS GuideId,
                hg.SendSMS,
                hg.Message,
                hg.SendSMSDate
            FROM dbo.Res_HolidayGuide hg
            INNER JOIN dbo.Res_Holidays rh ON rh.Pid = hg.ResHolidayXid
            INNER JOIN dbo.M_SupplierGuide g ON g.Pid = hg.SupplierGuideXid
            WHERE hg.SupplierGuideXid IS NOT NULL
              AND hg.ResHolidayXid IS NOT NULL
              AND (@CountryXid IS NULL OR g.CountryXid = @CountryXid)
              AND rh.ArrDate IS NOT NULL
              AND rh.ArrDate <= @RangeEnd
              AND DATEADD(day, CASE WHEN ISNULL(rh.NoOfNights, 1) < 1 THEN 1 ELSE rh.NoOfNights END, rh.ArrDate) >= @RangeStart;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<GuideRelationRow>(
            new CommandDefinition(
                sql,
                new
                {
                    RangeStart = rangeStart.ToDateTime(TimeOnly.MinValue),
                    RangeEnd = rangeEnd.ToDateTime(TimeOnly.MinValue),
                    CountryXid = countryXid
                },
                cancellationToken: cancellationToken));

        return rows.Select(row => new GuideRelation(
            row.BookingId,
            row.GuideId,
            row.IsConfirmed,
            row.Message ?? string.Empty,
            row.MessageDate)).ToArray();
    }

    private async Task<Dictionary<int, IReadOnlyList<BusyDateDto>>> GetGuideBusyDatesMapAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                gb.Pid,
                gb.SupplierGuideXid AS GuideId,
                gb.[Date],
                gb.Busy
            FROM dbo.M_GuideBusy gb;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<BusyDateRow>(new CommandDefinition(sql, cancellationToken: cancellationToken));

        return rows
            .Where(row => IsConfirmed(row.Busy))
            .GroupBy(row => row.GuideId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<BusyDateDto>)group.Select(row => new BusyDateDto
                {
                    Id = $"busy-{row.Pid}",
                    From = DateOnly.FromDateTime(row.Date),
                    To = DateOnly.FromDateTime(row.Date)
                }).ToArray());
    }

    private Dictionary<string, int> BuildBaseItemAssignments(
        IReadOnlyList<TimelineBookingDto> bookings,
        IReadOnlyDictionary<string, HashSet<int>> assignedGuideIdsByBooking,
        ISet<string> itemManagedBookingIds)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var booking in bookings)
        {
            if (itemManagedBookingIds.Contains(booking.Id))
            {
                continue;
            }

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

    private void ApplyItemAssignmentOverrides(IDictionary<string, int> itemAssignments)
    {
        foreach (var overrideEntry in bookingManagementState.ItemAssignmentOverrides)
        {
            if (overrideEntry.Value <= 0)
            {
                itemAssignments.Remove(overrideEntry.Key);
                continue;
            }

            itemAssignments[overrideEntry.Key] = overrideEntry.Value;
        }
    }

    private IReadOnlyDictionary<string, string> BuildItemTimeSlots(IEnumerable<string> itemIds)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var itemId in itemIds)
        {
            result[itemId] = "full-day";
        }

        foreach (var overrideEntry in bookingManagementState.ItemTimeSlotOverrides)
        {
            result[overrideEntry.Key] = overrideEntry.Value;
        }

        return result;
    }

    private static IReadOnlyList<int> GetAssignedGuideIdsForBooking(
        IReadOnlyDictionary<string, int> itemAssignments,
        string bookingId)
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

    private IReadOnlyList<GuideTimeExceptionDto> GetGuideTimeExceptionsFromOverrides()
    {
        return bookingManagementState.GuideTimeExceptionOverrides
            .SelectMany(entry => entry.Value)
            .Select(entry => new GuideTimeExceptionDto
            {
                Id = entry.Id,
                BookingId = entry.BookingId,
                GuideId = entry.GuideId,
                Date = entry.Date,
                StartHour = entry.StartHour,
                EndHour = entry.EndHour
            })
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
        var nextPid = await connection.ExecuteScalarAsync<int>(new CommandDefinition(nextPidSql, cancellationToken: cancellationToken));
        await connection.ExecuteAsync(
            new CommandDefinition(
                insertSql,
                new
                {
                    Pid = nextPid,
                    GuideId = guideId,
                    Date = date.ToDateTime(TimeOnly.MinValue)
                },
                cancellationToken: cancellationToken));
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
        await connection.ExecuteAsync(
            new CommandDefinition(
                sql,
                new
                {
                    BookingPid = bookingPid,
                    GuideId = guideId
                },
                cancellationToken: cancellationToken));
    }

    private async Task<int?> GetGuideIdByNameAsync(string guideName, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) g.Pid
            FROM dbo.M_SupplierGuide g
            WHERE g.Guide = @GuideName;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<int?>(
            new CommandDefinition(
                sql,
                new { GuideName = guideName },
                cancellationToken: cancellationToken));
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

    private static bool IsConfirmed(string? flag)
    {
        var normalized = (flag ?? string.Empty).Trim().ToUpperInvariant();
        return normalized is "Y" or "1" or "T";
    }

    private static bool MatchesBookingFilters(
        TimelineBookingDto booking,
        string? search,
        string? client,
        string? country,
        string? guide,
        string? series)
    {
        if (!ContainsIgnoreCase(booking.Ref, search) && !ContainsIgnoreCase(booking.GroupName, search) && !string.IsNullOrWhiteSpace(search))
        {
            return false;
        }

        if (!ContainsIgnoreCase(booking.Client, client))
        {
            return false;
        }

        if (!ContainsIgnoreCase(booking.Country, country))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(guide) &&
            !(booking.AssignedGuides?.Any(guideName => ContainsIgnoreCase(guideName, guide)) ?? false))
        {
            return false;
        }

        var normalizedSeries = (series ?? string.Empty).Trim().ToLowerInvariant();
        if (normalizedSeries is "series" or "noseries")
        {
            var hasSeries = !string.Equals(booking.Series, "NO SERIES", StringComparison.OrdinalIgnoreCase);
            if (normalizedSeries == "series" && !hasSeries)
            {
                return false;
            }

            if (normalizedSeries == "noseries" && hasSeries)
            {
                return false;
            }
        }

        return true;
    }

    private static bool ContainsIgnoreCase(string? source, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        return (source ?? string.Empty).Contains(value.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string DeriveSeriesFromGroupName(string? groupName)
    {
        if (string.IsNullOrWhiteSpace(groupName)) return "NO SERIES";
        if (groupName.Contains("AJJR", StringComparison.OrdinalIgnoreCase)) return "AJJR";
        if (groupName.Contains("LEUJ", StringComparison.OrdinalIgnoreCase)) return "LEUJ";
        if (groupName.Contains("HM", StringComparison.OrdinalIgnoreCase)) return "HM";
        if (groupName.Contains("LEJH", StringComparison.OrdinalIgnoreCase)) return "LEJH";
        if (groupName.Contains("AJBR", StringComparison.OrdinalIgnoreCase)) return "AJBR";
        return "NO SERIES";
    }

    private sealed record TimelineBookingRow(
        int Id,
        string? RefId,
        string? SubResNo,
        DateTime? StartDay,
        int Duration,
        string? Client,
        string? ServiceName,
        int? StatusXid,
        int? CountryXid,
        string? Holiday,
        string? Country);

    private sealed record GuideRow(int Id, string Name, string ExactCode);

    private sealed record GuideRelationRow(
        string BookingId,
        int GuideId,
        string? SendSMS,
        string? Message,
        DateTime? SendSMSDate)
    {
        public bool IsConfirmed => TimelineRepository.IsConfirmed(SendSMS);
        public DateOnly? MessageDate => SendSMSDate is null ? null : DateOnly.FromDateTime(SendSMSDate.Value);
    }

    private sealed record BusyDateRow(int Pid, int GuideId, DateTime Date, string? Busy);

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
