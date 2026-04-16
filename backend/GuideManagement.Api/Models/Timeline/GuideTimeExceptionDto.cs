namespace GuideManagement.Api.Models.Timeline;

public sealed class GuideTimeExceptionDto
{
    public string Id { get; init; } = string.Empty;
    public string BookingId { get; init; } = string.Empty;
    public int GuideId { get; init; }
    public DateOnly? Date { get; init; }
    public int StartHour { get; init; }
    public int EndHour { get; init; }
}
