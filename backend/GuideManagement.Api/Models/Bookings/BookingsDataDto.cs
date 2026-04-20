namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingsDataDto
{
    public IReadOnlyList<BookingsBookingDto> BookingsData { get; init; } = [];
    public IReadOnlyList<BookingsSeriesDto> BookingSeries { get; init; } = [];
    public IReadOnlyList<BookingsGuideDto> GuidesData { get; init; } = [];
    public IReadOnlyDictionary<string, int> ItemAssignments { get; init; } = new Dictionary<string, int>();
    public IReadOnlyDictionary<string, string> ItemTimeSlots { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, BookingsGuideEmailRecordDto> EmailRecords { get; init; } =
        new Dictionary<string, BookingsGuideEmailRecordDto>();
    public IReadOnlyList<BookingsGuideTimeExceptionDto> GuideTimeExceptions { get; init; } = [];
}
