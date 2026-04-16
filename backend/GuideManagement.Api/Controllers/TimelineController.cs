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
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.GetTimelineAsync(from, to, cancellationToken);
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

    [HttpPost("guide-time-exceptions")]
    public async Task<ActionResult<TimelineDataDto>> SetGuideBookingTimeExceptions(
        [FromBody] GuideTimeExceptionsUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var timeline = await timelineRepository.SetGuideBookingTimeExceptionsAsync(request, cancellationToken);
        return Ok(timeline);
    }
}
