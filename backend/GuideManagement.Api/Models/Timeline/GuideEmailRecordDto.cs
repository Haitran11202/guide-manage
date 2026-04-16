namespace GuideManagement.Api.Models.Timeline;

public sealed class GuideEmailRecordDto
{
    public string BookingId { get; init; } = string.Empty;
    public int GuideId { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateOnly? Date { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
}
