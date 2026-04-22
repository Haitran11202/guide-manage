namespace GuideManagement.Api.Models.Timeline;

public sealed class UnassignBookingItemsRequest
{
    public IReadOnlyList<int> ResHolidayIds { get; init; } = [];
}
