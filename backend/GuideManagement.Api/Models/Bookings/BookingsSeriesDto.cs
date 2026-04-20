namespace GuideManagement.Api.Models.Bookings;

public sealed class BookingsSeriesDto
{
    public string Series { get; init; } = string.Empty;
    public int Total { get; init; }
    public int Assigned { get; init; }
    public int NotAssigned { get; init; }
    public int Cancelled { get; init; }
    public int OnRequest { get; init; }
    public int Confirmed { get; init; }
}
