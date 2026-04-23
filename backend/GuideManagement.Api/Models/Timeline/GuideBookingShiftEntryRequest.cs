namespace GuideManagement.Api.Models.Timeline;

public sealed class GuideBookingShiftEntryRequest
{
    public DateOnly? Date { get; init; }
    public string Shift { get; init; } = "ALL";
}
