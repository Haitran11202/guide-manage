using System.Collections.Concurrent;

namespace GuideManagement.Api.Services;

public sealed class BookingManagementState : IBookingManagementState
{
    public ConcurrentDictionary<string, int> ItemAssignmentOverrides { get; } = new(StringComparer.OrdinalIgnoreCase);
    public ConcurrentDictionary<string, string> ItemTimeSlotOverrides { get; } = new(StringComparer.OrdinalIgnoreCase);
    public ConcurrentDictionary<string, IReadOnlyList<GuideTimeExceptionOverrideEntry>> GuideTimeExceptionOverrides { get; } =
        new(StringComparer.OrdinalIgnoreCase);
    public ConcurrentDictionary<string, byte> ItemManagedBookingIds { get; } = new(StringComparer.OrdinalIgnoreCase);
}
