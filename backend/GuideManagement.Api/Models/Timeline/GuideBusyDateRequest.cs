namespace GuideManagement.Api.Models.Timeline;

public sealed class GuideBusyDateRequest
{
    public int GuideId { get; init; }
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
}
