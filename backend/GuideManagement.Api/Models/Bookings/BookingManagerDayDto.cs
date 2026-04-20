namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingManagerDayDto
{
    public int DayNum { get; init; }
    public DateOnly Date { get; init; }
    public IReadOnlyList<BookingManagerItemDto> Items { get; init; } = [];
}
