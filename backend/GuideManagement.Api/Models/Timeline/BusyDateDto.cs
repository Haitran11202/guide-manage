namespace GuideManagement.Api.Models.Timeline;

public sealed class BusyDateDto
{
    public string Id { get; init; } = string.Empty;
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
    public string? Busy { get; init; }
}
