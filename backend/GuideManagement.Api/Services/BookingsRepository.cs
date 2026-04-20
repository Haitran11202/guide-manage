using Dapper;
using GuideManagement.Api.Models.Bookings;
using Microsoft.Data.SqlClient;

namespace GuideManagement.Api.Services;

public sealed class BookingsRepository(
    ISqlConnectionFactory connectionFactory,
    IBookingManagementState bookingManagementState) : IBookingsRepository
{
    private const int BookingSeriesPageSize = 10;

    public async Task<BookingsDataDto> GetBookingsAsync(
        DateOnly? from,
        DateOnly? to,
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
        var bookings = await GetBookingsRowsAsync(rangeStart, rangeEnd, cancellationToken);
        var guides = await GetGuideRowsAsync(cancellationToken);
        var relations = await GetGuideRelationsAsync(rangeStart, rangeEnd, cancellationToken);
        var busyDates = await GetBusyDateRowsAsync(cancellationToken);

        return BuildBookingsData(
            bookings,
            guides,
            relations,
            busyDates,
            search,
            client,
            country,
            guide,
            series,
            loadSeries,
            seriesSkip,
            seriesTake);
    }

    public async Task<BookingManagerDataDto> GetBookingManagerAsync(string bookingRef, CancellationToken cancellationToken)
    {
        if (!int.TryParse(bookingRef, out var resXid))
        {
            return new BookingManagerDataDto();
        }

        var rows = await GetBookingManagerRowsAsync(resXid, cancellationToken);
        if (rows.Count == 0)
        {
            return new BookingManagerDataDto();
        }

        var bookingRow = rows[0];
        if (!bookingRow.StartDay.HasValue)
        {
            return new BookingManagerDataDto();
        }

        var bookingId = bookingRow.BookingId.ToString();
        var startDay = DateOnly.FromDateTime(bookingRow.StartDay.Value);
        var duration = Math.Max(1, bookingRow.Duration);
        var days = new List<BookingManagerDayDto>(duration);
        var managerItemIds = new List<string>();

        for (var day = 1; day <= duration; day += 1)
        {
            var currentDate = startDay.AddDays(day - 1);
            var items = rows
                .Where(row => row.ServiceDate.HasValue && DateOnly.FromDateTime(row.ServiceDate.Value) == currentDate)
                .Select(row => new BookingManagerItemDto
                {
                    Id = $"{bookingId}-d{day}-svc{row.ServicePid}",
                    Type = BuildManagerServiceLabel(row.ServiceName, row.Holiday)
                })
                .DistinctBy(item => item.Id)
                .ToArray();

            managerItemIds.AddRange(items.Select(item => item.Id));
            days.Add(new BookingManagerDayDto
            {
                DayNum = day,
                Date = currentDate,
                Items = items
            });
        }

        var assignedGuideIds = await GetGuideIdsForBookingAsync(bookingRow.BookingId, cancellationToken);
        var itemAssignments = BuildManagerItemAssignments(managerItemIds, assignedGuideIds);
        ApplyManagerItemAssignmentOverrides(itemAssignments, managerItemIds);
        var itemTimeSlots = BuildManagerItemTimeSlots(managerItemIds);

        return new BookingManagerDataDto
        {
            Days = days,
            ItemAssignments = itemAssignments,
            ItemTimeSlots = itemTimeSlots
        };
    }

    private BookingsDataDto BuildBookingsData(
        IReadOnlyList<BookingsBookingDto> bookings,
        IReadOnlyList<GuideRow> guideRows,
        IReadOnlyList<GuideRelationRow> relations,
        IReadOnlyList<BusyDateRow> busyDateRows,
        string? search,
        string? client,
        string? country,
        string? guide,
        string? series,
        string? loadSeries,
        int? seriesSkip,
        int? seriesTake)
    {
        var guideNameById = guideRows.ToDictionary(item => item.Id, item => item.Name);

        var assignedGuideIdsByBooking = new Dictionary<string, HashSet<int>>(StringComparer.OrdinalIgnoreCase);
        var confirmedGuideIdsByBooking = new Dictionary<string, HashSet<int>>(StringComparer.OrdinalIgnoreCase);
        var emailRecords = new Dictionary<string, BookingsGuideEmailRecordDto>(StringComparer.OrdinalIgnoreCase);

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
                emailRecords[$"{relation.BookingId}-{relation.GuideId}"] = new BookingsGuideEmailRecordDto
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

        var itemManagedBookingIds = bookingManagementState.ItemManagedBookingIds.Keys.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var itemAssignments = BuildBaseItemAssignments(bookings, assignedGuideIdsByBooking, itemManagedBookingIds);
        ApplyItemAssignmentOverrides(itemAssignments);
        var itemTimeSlots = BuildItemTimeSlots(itemAssignments.Keys);
        var guideTimeExceptions = GetGuideTimeExceptionsFromOverrides();

        var filteredBookings = bookings
            .Select(booking =>
            {
                var assignedGuideIds = GetAssignedGuideIdsForBooking(itemAssignments, booking.Id).ToHashSet();
                var confirmedGuideIds = confirmedGuideIdsByBooking.TryGetValue(booking.Id, out var confirmed)
                    ? confirmed.Where(assignedGuideIds.Contains).ToHashSet()
                    : [];

                return new BookingsBookingDto
                {
                    Id = booking.Id,
                    Series = string.IsNullOrWhiteSpace(booking.Series) ? "NO SERIES" : booking.Series.Trim(),
                    Ref = booking.Ref,
                    StartDay = booking.StartDay,
                    Duration = booking.Duration,
                    Client = booking.Client,
                    GroupName = booking.GroupName,
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
                return new BookingsSeriesDto
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

        IReadOnlyList<BookingsBookingDto> bookingsData;
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
            .ToDictionary(group => group.Key, group => (IReadOnlyList<BookingsGuideTimeExceptionDto>)group.ToArray());

        var busyDatesByGuide = busyDateRows
            .Where(row => IsConfirmed(row.Busy))
            .GroupBy(row => row.GuideId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<BookingsBusyDateDto>)group.Select(row => new BookingsBusyDateDto
                {
                    Id = $"busy-{row.Pid}",
                    From = DateOnly.FromDateTime(row.Date),
                    To = DateOnly.FromDateTime(row.Date)
                }).ToArray());

        var guidesData = guideRows
            .Select(guideRow => new BookingsGuideDto
            {
                Id = guideRow.Id,
                Name = guideRow.Name,
                Tags = string.IsNullOrWhiteSpace(guideRow.ExactCode) ? [] : [guideRow.ExactCode],
                BusyDates = busyDatesByGuide.TryGetValue(guideRow.Id, out var dates) ? dates : [],
                TimeExceptions = guideExceptionsByGuide.TryGetValue(guideRow.Id, out var guideExceptions) ? guideExceptions : []
            })
            .ToArray();

        return new BookingsDataDto
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

    private async Task<IReadOnlyList<BookingsBookingDto>> GetBookingsRowsAsync(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        CancellationToken cancellationToken)
    {
        const string sql = @"SELECT
    CAST(packageRh.Pid AS varchar(20)) AS Id,
    CAST(res.Pid AS nvarchar(50)) AS Ref,
    c.Code AS Client,
    res.PartyName AS GroupName,
    res.ArrDate AS StartDay, 
    CASE WHEN ISNULL(res.NoOfNights, 1) < 1 THEN 1 ELSE res.NoOfNights END AS Duration, 
    res.Status, 
    CountryData.Countries AS Country, 
    COALESCE(NULLIF(mh.Code, ''), 'NO SERIES') AS Series
FROM dbo.Res res
INNER JOIN dbo.M_Client c ON c.Pid = res.ClientXid

-- 1. Ghép chuỗi Quốc gia từ Res_Holidays
OUTER APPLY (
    SELECT STUFF((
        SELECT DISTINCT ', ' + mc.Country
        FROM dbo.Res_Holidays rh_c
        INNER JOIN dbo.M_Country mc ON mc.Pid = rh_c.CountryXid
        WHERE rh_c.ResXid = res.Pid 
          AND rh_c.StatusXid != 9
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, ''
    ) AS Countries
) AS CountryData

-- 2. Lấy Id và Series từ gói Holiday chính (Đã lược bỏ ServiceName, Holiday)
CROSS APPLY (
    SELECT TOP (1)
        rh.Pid,
        rh.HolidayXid
    FROM dbo.Res_Holidays rh
    WHERE rh.ResXid = res.Pid
      AND rh.StatusXid != 9
    ORDER BY rh.NoOfNights DESC, rh.Pid DESC
) packageRh

LEFT JOIN dbo.M_Holidays mh ON mh.Pid = packageRh.HolidayXid

-- 3. Bộ lọc ngày tháng dựa trên dữ liệu bảng Res
WHERE res.ArrDate IS NOT NULL
  AND res.ArrDate <= @RangeEnd
  AND DATEADD(day, CASE WHEN ISNULL(res.NoOfNights, 1) < 1 THEN 1 ELSE res.NoOfNights END, res.ArrDate) >= @RangeStart

ORDER BY res.ArrDate, res.Pid;";

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<BookingsBaseRow>(
            new CommandDefinition(
                sql,
                new
                {
                    RangeStart = rangeStart.ToDateTime(TimeOnly.MinValue),
                    RangeEnd = rangeEnd.ToDateTime(TimeOnly.MinValue),
                },
                cancellationToken: cancellationToken));

        return rows.Select(row => new BookingsBookingDto
        {
            Id = row.Id,
            Series = string.IsNullOrWhiteSpace(row.Series) ? "NO SERIES" : row.Series.Trim(),
            Ref = string.IsNullOrWhiteSpace(row.Ref) ? row.Id : row.Ref,
            StartDay = row.StartDay is null ? null : DateOnly.FromDateTime(row.StartDay.Value),
            Duration = Math.Max(1, row.Duration),
            Client = row.Client ?? string.Empty,
            GroupName = row.GroupName ?? string.Empty,
            Status = row.Status ?? string.Empty,
            Country = row.Country ?? string.Empty,
            AssignedGuides = [],
            ConfirmedGuides = []
        }).ToArray();
    }

    private async Task<IReadOnlyList<GuideRow>> GetGuideRowsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                g.Pid AS Id,
                g.Guide AS Name,
                LTRIM(RTRIM(ISNULL(g.ExactCode, ''))) AS ExactCode
            FROM dbo.M_SupplierGuide g
            ORDER BY g.Guide;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<GuideRow>(new CommandDefinition(sql, cancellationToken: cancellationToken));
        return rows.ToArray();
    }

    private async Task<IReadOnlyList<BookingManagerRow>> GetBookingManagerRowsAsync(int resXid, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                packageRh.Pid AS BookingId,
                res.ArrDate AS StartDay,
                CASE WHEN ISNULL(res.NoOfNights, 1) < 1 THEN 1 ELSE res.NoOfNights END AS Duration,
                rh.Pid AS ServicePid,
                rh.ArrDate AS ServiceDate,
                CAST(ISNULL(rh.ServiceName, '') AS nvarchar(255)) AS ServiceName,
                CAST(ISNULL(rh.Holiday, '') AS nvarchar(255)) AS Holiday
            FROM dbo.Res res
            CROSS APPLY (
                SELECT TOP (1)
                    pkg.Pid
                FROM dbo.Res_Holidays pkg
                WHERE pkg.ResXid = res.Pid
                  AND pkg.StatusXid != 9
                ORDER BY pkg.NoOfNights DESC, pkg.Pid DESC
            ) packageRh
            LEFT JOIN dbo.Res_Holidays rh
                ON rh.ResXid = res.Pid
               AND rh.StatusXid != 9
               AND rh.ArrDate IS NOT NULL
            WHERE res.Pid = @ResXid;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<BookingManagerRow>(
            new CommandDefinition(
                sql,
                new { ResXid = resXid },
                cancellationToken: cancellationToken));
        return rows.ToArray();
    }

    private async Task<IReadOnlyList<GuideRelationRow>> GetGuideRelationsAsync(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                CAST(packageRh.Pid AS varchar(20)) AS BookingId,
                rh.GuideXid AS GuideId,
                CAST(NULL AS char(1)) AS SendSMS,
                CAST(NULL AS nvarchar(MAX)) AS Message,
                CAST(NULL AS datetime) AS SendSMSDate
            FROM dbo.Res_Holidays rh
            INNER JOIN dbo.Res res ON res.Pid = rh.ResXid
            CROSS APPLY (
                SELECT TOP (1)
                    pkg.Pid
                FROM dbo.Res_Holidays pkg
                WHERE pkg.ResXid = res.Pid
                  AND pkg.ElementType = 'P'
                  AND pkg.ArrDate IS NOT NULL
                  AND pkg.ArrDate <= @RangeEnd
                  AND DATEADD(day, CASE WHEN ISNULL(pkg.NoOfNights, 1) < 1 THEN 1 ELSE pkg.NoOfNights END, pkg.ArrDate) >= @RangeStart
                ORDER BY pkg.NoOfNights DESC, pkg.Pid DESC
            ) packageRh
            WHERE rh.GuideXid IS NOT NULL

            UNION ALL

            SELECT
                CAST(packageRh.Pid AS varchar(20)) AS BookingId,
                hg.SupplierGuideXid AS GuideId,
                hg.SendSMS,
                hg.Message,
                hg.SendSMSDate
            FROM dbo.Res_HolidayGuide hg
            INNER JOIN dbo.Res_Holidays rh ON rh.Pid = hg.ResHolidayXid
            INNER JOIN dbo.Res res ON res.Pid = rh.ResXid
            CROSS APPLY (
                SELECT TOP (1)
                    pkg.Pid
                FROM dbo.Res_Holidays pkg
                WHERE pkg.ResXid = res.Pid
                  AND pkg.ElementType = 'P'
                  AND pkg.ArrDate IS NOT NULL
                  AND pkg.ArrDate <= @RangeEnd
                  AND DATEADD(day, CASE WHEN ISNULL(pkg.NoOfNights, 1) < 1 THEN 1 ELSE pkg.NoOfNights END, pkg.ArrDate) >= @RangeStart
                ORDER BY pkg.NoOfNights DESC, pkg.Pid DESC
            ) packageRh
            WHERE hg.SupplierGuideXid IS NOT NULL
              AND hg.ResHolidayXid IS NOT NULL;
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
                },
                cancellationToken: cancellationToken));
        return rows.ToArray();
    }

    private async Task<IReadOnlyList<int>> GetGuideIdsForBookingAsync(int bookingPid, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT DISTINCT GuideId
            FROM
            (
                SELECT rh.GuideXid AS GuideId
                FROM dbo.Res_Holidays rh
                WHERE rh.Pid = @BookingPid
                  AND rh.GuideXid IS NOT NULL

                UNION ALL

                SELECT hg.SupplierGuideXid AS GuideId
                FROM dbo.Res_HolidayGuide hg
                WHERE hg.ResHolidayXid = @BookingPid
                  AND hg.SupplierGuideXid IS NOT NULL
            ) source
            WHERE GuideId IS NOT NULL
            ORDER BY GuideId;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        var rows = await connection.QueryAsync<int>(
            new CommandDefinition(
                sql,
                new { BookingPid = bookingPid },
                cancellationToken: cancellationToken));
        return rows.ToArray();
    }

    private async Task<IReadOnlyList<BusyDateRow>> GetBusyDateRowsAsync(CancellationToken cancellationToken)
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
        return rows.ToArray();
    }

    private Dictionary<string, int> BuildBaseItemAssignments(
        IReadOnlyList<BookingsBookingDto> bookings,
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

    private static Dictionary<string, int> BuildManagerItemAssignments(
        IReadOnlyList<string> itemIds,
        IReadOnlyList<int> guideIds)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (itemIds.Count == 0 || guideIds.Count == 0)
        {
            return result;
        }

        var orderedGuideIds = guideIds.OrderBy(value => value).ToArray();
        for (var index = 0; index < itemIds.Count; index += 1)
        {
            result[itemIds[index]] = orderedGuideIds[index % orderedGuideIds.Length];
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

    private void ApplyManagerItemAssignmentOverrides(IDictionary<string, int> itemAssignments, IReadOnlyCollection<string> managerItemIds)
    {
        var itemIdSet = managerItemIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var overrideEntry in bookingManagementState.ItemAssignmentOverrides)
        {
            if (!itemIdSet.Contains(overrideEntry.Key))
            {
                continue;
            }

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

    private IReadOnlyDictionary<string, string> BuildManagerItemTimeSlots(IReadOnlyCollection<string> itemIds)
    {
        var result = itemIds.ToDictionary(itemId => itemId, _ => "full-day", StringComparer.OrdinalIgnoreCase);
        foreach (var overrideEntry in bookingManagementState.ItemTimeSlotOverrides)
        {
            if (result.ContainsKey(overrideEntry.Key))
            {
                result[overrideEntry.Key] = overrideEntry.Value;
            }
        }

        return result;
    }

    private IReadOnlyList<BookingsGuideTimeExceptionDto> GetGuideTimeExceptionsFromOverrides()
    {
        return bookingManagementState.GuideTimeExceptionOverrides
            .SelectMany(entry => entry.Value)
            .Select(entry => new BookingsGuideTimeExceptionDto
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

    private static bool MatchesBookingFilters(
        BookingsBookingDto booking,
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

    private static string BuildManagerServiceLabel(string? serviceName, string? holiday)
    {
        var normalizedServiceName = (serviceName ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(normalizedServiceName))
        {
            return normalizedServiceName;
        }

        var normalizedHoliday = (holiday ?? string.Empty).Trim();
        return !string.IsNullOrWhiteSpace(normalizedHoliday) ? normalizedHoliday : "Service";
    }

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

    private sealed record BookingsBaseRow(
        string Id,
        string Ref,
        string Client,
        string GroupName,
        DateTime? StartDay,
        int Duration,
        string Status,
        string? Country,
        string Series);

    private sealed record GuideRow(int Id, string Name, string ExactCode);

    private sealed record GuideRelationRow(
        string BookingId,
        int GuideId,
        string? SendSMS,
        string? Message,
        DateTime? SendSMSDate)
    {
        public bool IsConfirmed => BookingsRepository.IsConfirmed(SendSMS);
        public DateOnly? MessageDate => SendSMSDate is null ? null : DateOnly.FromDateTime(SendSMSDate.Value);
    }

    private sealed record BookingManagerRow(
        int BookingId,
        DateTime? StartDay,
        int Duration,
        int? ServicePid,
        DateTime? ServiceDate,
        string? ServiceName,
        string? Holiday);

    private sealed record BusyDateRow(int Pid, int GuideId, DateTime Date, string Busy);
}
