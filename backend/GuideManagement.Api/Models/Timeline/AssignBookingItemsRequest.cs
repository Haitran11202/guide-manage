namespace GuideManagement.Api.Models.Timeline;

public sealed class AssignBookingItemsRequest
{
    public int GuideId { get; init; }
    public IReadOnlyList<int> ResHolidayIds { get; init; } = [];
}
