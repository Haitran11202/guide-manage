using GuideManagement.Api.Models.Bookings;
using GuideManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuideManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class BookingsController(IBookingsRepository bookingsRepository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<BookingsDataDto>> GetBookings(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string? search,
        [FromQuery] string? client,
        [FromQuery] string? country,
        [FromQuery] string? guide,
        [FromQuery] string? series,
        [FromQuery] string? loadSeries,
        [FromQuery] int? seriesSkip,
        [FromQuery] int? seriesTake,
        CancellationToken cancellationToken)
    {
        var bookings = await bookingsRepository.GetBookingsAsync(
            from,
            to,
            search,
            client,
            country,
            guide,
            series,
            loadSeries,
            seriesSkip,
            seriesTake,
            cancellationToken);
        return Ok(bookings);
    }

    [HttpGet("{bookingRef}/manager")]
    public async Task<ActionResult<BookingManagerDataDto>> GetBookingManager(
        string bookingRef,
        CancellationToken cancellationToken)
    {
        var data = await bookingsRepository.GetBookingManagerAsync(bookingRef, cancellationToken);
        return Ok(data);
    }
}
