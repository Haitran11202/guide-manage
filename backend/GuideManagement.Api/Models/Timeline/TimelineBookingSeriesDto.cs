namespace GuideManagement.Api.Models.Timeline;

public sealed class TimelineBookingSeriesDto
{
    public string Series { get; init; } = string.Empty;
    public int Total { get; init; }
    public int Assigned { get; init; }
    public int NotAssigned { get; init; }
    public int Cancelled { get; init; }
    public int OnRequest { get; init; }
    public int Confirmed { get; init; }
}
