namespace GuideManagement.Api.Models.Timeline;

public sealed class TimelineDataDto
{
    public IReadOnlyList<TimelineBookingDto> BookingsData { get; init; } = [];
    public IReadOnlyList<TimelineBookingSeriesDto> BookingSeries { get; init; } = [];
    public IReadOnlyList<TimelineGuideDto> GuidesData { get; init; } = [];
    public IReadOnlyDictionary<string, int> ItemAssignments { get; init; } = new Dictionary<string, int>();
    public IReadOnlyDictionary<string, string> ItemTimeSlots { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, GuideEmailRecordDto> EmailRecords { get; init; } = new Dictionary<string, GuideEmailRecordDto>();
    public IReadOnlyList<GuideTimeExceptionDto> GuideTimeExceptions { get; init; } = [];
}
