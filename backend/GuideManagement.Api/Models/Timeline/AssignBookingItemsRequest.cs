namespace GuideManagement.Api.Models.Timeline;

public sealed class AssignBookingItemsRequest
{
    public string BookingId { get; init; } = string.Empty;
    public int GuideId { get; init; }
    public IReadOnlyList<string> ItemIds { get; init; } = [];
}
