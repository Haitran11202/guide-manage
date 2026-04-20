using GuideManagement.Api.Models.Bookings;

namespace GuideManagement.Api.Services;

public interface IBookingsRepository
{
    Task<BookingsDataDto> GetBookingsAsync(
        DateOnly? from,
        DateOnly? to,
        string? search,
        string? client,
        string? country,
        string? guide,
        string? series,
        string? loadSeries,
        int? seriesSkip,
        int? seriesTake,
        CancellationToken cancellationToken);

    Task<BookingManagerDataDto> GetBookingManagerAsync(string bookingRef, CancellationToken cancellationToken);
}
