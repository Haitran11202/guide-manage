namespace GuideManagement.Api.Models.Timeline;

public sealed class GuideTimeExceptionsUpsertRequest
{
    public string BookingId { get; init; } = string.Empty;
    public int GuideId { get; init; }
    public IReadOnlyList<GuideTimeExceptionEntryRequest> Entries { get; init; } = [];
}
