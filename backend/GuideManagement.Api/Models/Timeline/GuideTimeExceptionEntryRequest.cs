namespace GuideManagement.Api.Models.Timeline;

public sealed class GuideTimeExceptionEntryRequest
{
    public DateOnly? Date { get; init; }
    public int StartHour { get; init; }
    public int EndHour { get; init; }
}
