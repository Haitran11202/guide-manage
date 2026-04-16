namespace GuideManagement.Api.Models.Timeline;

public sealed class UnassignBookingItemsRequest
{
    public string BookingId { get; init; } = string.Empty;
    public IReadOnlyList<string> ItemIds { get; init; } = [];
}
