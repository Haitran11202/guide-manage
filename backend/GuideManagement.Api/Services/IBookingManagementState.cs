using System.Collections.Concurrent;

namespace GuideManagement.Api.Services;

public interface IBookingManagementState
{
    ConcurrentDictionary<string, int> ItemAssignmentOverrides { get; }
    ConcurrentDictionary<string, string> ItemTimeSlotOverrides { get; }
    ConcurrentDictionary<string, IReadOnlyList<GuideTimeExceptionOverrideEntry>> GuideTimeExceptionOverrides { get; }
    ConcurrentDictionary<string, byte> ItemManagedBookingIds { get; }
}

public sealed record GuideTimeExceptionOverrideEntry(
    string Id,
    string BookingId,
    int GuideId,
    DateOnly? Date,
    int StartHour,
    int EndHour);
