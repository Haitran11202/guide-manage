namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingsBookingDto
{
    public string Id { get; init; } = string.Empty;
    public string Series { get; init; } = string.Empty;
    public string Ref { get; init; } = string.Empty;
    public DateOnly? StartDay { get; init; }
    public int Duration { get; init; }
    public string Client { get; init; } = string.Empty;
    public string GroupName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? Country { get; init; }
    public IReadOnlyList<string> AssignedGuides { get; init; } = [];
    public IReadOnlyList<string> ConfirmedGuides { get; init; } = [];
    public IReadOnlyDictionary<string, int> GuideStatuses { get; init; } = new Dictionary<string, int>();
}
