namespace GuideManagement.Api.Models.Timeline;

public sealed class BookingGuideConfirmationRequest
{
    public string BookingId { get; init; } = string.Empty;
    public string GuideName { get; init; } = string.Empty;
    public bool Confirmed { get; init; }
}
