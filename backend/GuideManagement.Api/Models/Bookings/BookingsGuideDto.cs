namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingsGuideDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public IReadOnlyList<string> Tags { get; init; } = [];
    public IReadOnlyList<BookingsBusyDateDto> BusyDates { get; init; } = [];
    public IReadOnlyList<BookingsGuideTimeExceptionDto> TimeExceptions { get; init; } = [];
}
