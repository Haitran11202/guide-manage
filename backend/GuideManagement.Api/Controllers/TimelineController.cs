using GuideManagement.Api.Models.Timeline;
using GuideManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuideManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class TimelineController(ITimelineRepository timelineRepository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TimelineDataDto>> GetTimeline(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? countryXid,
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
        var timeline = await timelineRepository.GetTimelineAsync(
            from,
            to,
            countryXid,
            search,
            client,
            country,
            guide,
            series,
            loadSeries,
            seriesSkip,
            seriesTake,
            cancellationToken);
        return Ok(timeline);
    }

    [HttpPost("booking-guide-confirmation")]
    public async Task<ActionResult<TimelineDataDto>> SetBookingGuideConfirmation(
        [FromBody] BookingGuideConfirmationRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.SetBookingGuideConfirmationAsync(request, cancellationToken);
        return Ok(timeline);
    }

    [HttpPost("guide-busy-dates")]
    public async Task<ActionResult<TimelineDataDto>> AddGuideBusyDate(
        [FromBody] GuideBusyDateRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.AddGuideBusyDateAsync(request, cancellationToken);
        return Ok(timeline);
    }

    [HttpDelete("guide-busy-dates/{guideId:int}/{busyDateId}")]
    public async Task<ActionResult<TimelineDataDto>> RemoveGuideBusyDate(
        int guideId,
        string busyDateId,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.RemoveGuideBusyDateAsync(guideId, busyDateId, cancellationToken);
        return Ok(timeline);
    }

    [HttpPost("booking-item-time-slot")]
    public async Task<ActionResult<TimelineDataDto>> SetBookingItemTimeSlot(
        [FromBody] BookingItemTimeSlotRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.SetBookingItemTimeSlotAsync(request, cancellationToken);
        return Ok(timeline);
    }

    [HttpPost("assign-booking-items")]
    public async Task<ActionResult<TimelineDataDto>> AssignBookingItems(
        [FromBody] AssignBookingItemsRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.AssignBookingItemsAsync(request, cancellationToken);
        return Ok(timeline);
    }

    [HttpPost("unassign-booking-items")]
    public async Task<ActionResult<TimelineDataDto>> UnassignBookingItems(
        [FromBody] UnassignBookingItemsRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.UnassignBookingItemsAsync(request, cancellationToken);
        return Ok(timeline);
    }

    [HttpDelete("bookings/{bookingId}/guides/{guideName}")]
    public async Task<ActionResult<TimelineDataDto>> UnassignGuideFromBooking(
        string bookingId,
        string guideName,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.UnassignGuideFromBookingAsync(bookingId, guideName, cancellationToken);
        return Ok(timeline);
    }

    [HttpPost("guide-email-record")]
    public async Task<ActionResult<TimelineDataDto>> SetGuideEmailRecord(
        [FromBody] GuideEmailRecordUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.SetGuideEmailRecordAsync(request, cancellationToken);
        return Ok(timeline);
    }

    [HttpGet("guide-booking-shifts/{bookingId}/{guideId:int}")]
    public async Task<ActionResult<IReadOnlyList<GuideBookingShiftDto>>> GetGuideBookingShifts(
        string bookingId,
        int guideId,
        CancellationToken cancellationToken)
    {
        var shifts = await timelineRepository.GetGuideBookingShiftsAsync(bookingId, guideId, cancellationToken);
        return Ok(shifts);
    }

    [HttpPost("guide-booking-shifts")]
    public async Task<ActionResult<TimelineDataDto>> SetGuideBookingShifts(
        [FromBody] GuideBookingShiftsUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.SetGuideBookingShiftsAsync(request, cancellationToken);
        return Ok(timeline);
    }

    [HttpPost("guide-time-exceptions")]
    public async Task<ActionResult<TimelineDataDto>> SetGuideBookingTimeExceptions(
        [FromBody] GuideTimeExceptionsUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.SetGuideBookingTimeExceptionsAsync(request, cancellationToken);
        return Ok(timeline);
    }
}
