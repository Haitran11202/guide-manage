namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingManagerDataDto
{
    public IReadOnlyList<BookingManagerDayDto> Days { get; init; } = [];
    public IReadOnlyDictionary<string, int> ItemAssignments { get; init; } = new Dictionary<string, int>();
    public IReadOnlyDictionary<string, string> ItemTimeSlots { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, int> GuideStatuses { get; init; } = new Dictionary<string, int>();
}
