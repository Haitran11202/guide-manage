namespace GuideManagement.Api.Models.Timeline;

public sealed class TimelineGuideDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public IReadOnlyList<string> Tags { get; init; } = [];
    public IReadOnlyList<BusyDateDto> BusyDates { get; init; } = [];
    public IReadOnlyList<GuideTimeExceptionDto> TimeExceptions { get; init; } = [];
}
