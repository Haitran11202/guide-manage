namespace GuideManagement.Api.Models.Timeline;

public sealed class TimelineBookingDto
{
    public string Id { get; init; } = string.Empty;
    public string Ref { get; init; } = string.Empty;
    public DateOnly? StartDay { get; init; }
    public int Duration { get; init; }
    public string Client { get; init; } = string.Empty;
    public string GroupName { get; init; } = string.Empty;
    public string TourName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? Country { get; init; }
    public IReadOnlyList<string> AssignedGuides { get; init; } = [];
    public IReadOnlyList<string> ConfirmedGuides { get; init; } = [];
}
