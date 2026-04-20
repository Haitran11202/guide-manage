namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingsGuideEmailRecordDto
{
    public string BookingId { get; init; } = string.Empty;
    public int GuideId { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateOnly? Date { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
}
