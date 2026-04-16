using GuideManagement.Api.Models.Timeline;

namespace GuideManagement.Api.Services;

public interface ITimelineRepository
{
    Task<TimelineDataDto> GetTimelineAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken);
    Task<TimelineDataDto> SetBookingGuideConfirmationAsync(BookingGuideConfirmationRequest request, CancellationToken cancellationToken);
    Task<TimelineDataDto> AddGuideBusyDateAsync(GuideBusyDateRequest request, CancellationToken cancellationToken);
    Task<TimelineDataDto> RemoveGuideBusyDateAsync(int guideId, string busyDateId, CancellationToken cancellationToken);
    Task<TimelineDataDto> SetBookingItemTimeSlotAsync(BookingItemTimeSlotRequest request, CancellationToken cancellationToken);
    Task<TimelineDataDto> AssignBookingItemsAsync(AssignBookingItemsRequest request, CancellationToken cancellationToken);
    Task<TimelineDataDto> UnassignBookingItemsAsync(UnassignBookingItemsRequest request, CancellationToken cancellationToken);
    Task<TimelineDataDto> UnassignGuideFromBookingAsync(string bookingId, string guideName, CancellationToken cancellationToken);
    Task<TimelineDataDto> SetGuideEmailRecordAsync(GuideEmailRecordUpsertRequest request, CancellationToken cancellationToken);
    Task<TimelineDataDto> SetGuideBookingTimeExceptionsAsync(GuideTimeExceptionsUpsertRequest request, CancellationToken cancellationToken);
}
