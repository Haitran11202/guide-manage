namespace GuideManagement.Api.Models.Timeline;

public sealed class GuideBookingShiftsUpsertRequest
{
    public string BookingId { get; init; } = string.Empty;
    public int GuideId { get; init; }
    public IReadOnlyList<GuideBookingShiftEntryRequest> Entries { get; init; } = [];
}
