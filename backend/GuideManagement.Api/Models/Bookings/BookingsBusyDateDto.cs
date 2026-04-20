namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingsBusyDateDto
{
    public string Id { get; init; } = string.Empty;
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
}
