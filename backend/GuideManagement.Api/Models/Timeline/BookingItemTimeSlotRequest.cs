namespace GuideManagement.Api.Models.Timeline;

public sealed class BookingItemTimeSlotRequest
{
    public string ItemId { get; init; } = string.Empty;
    public string Slot { get; init; } = "full-day";
}
