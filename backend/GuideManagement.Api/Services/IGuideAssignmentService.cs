using GuideManagement.Api.Models.ServiceGuideAssignments;

namespace GuideManagement.Api.Services;

public interface IGuideAssignmentService
{
    Task<IReadOnlyList<AvailableGuideDto>> SearchAvailableGuidesAsync(
        DateTime arrDate,
        string? maCa,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<AvailableGuideDto>> SearchAvailableGuidesAsync(
        IReadOnlyList<DateTime> arrDates,
        string? maCa,
        CancellationToken cancellationToken);

    Task<AssignGuideToServiceResponse> AssignGuideToServiceAsync(
        AssignGuideToServiceRequest request,
        CancellationToken cancellationToken);

    Task<AssignGuideToServicesResponse> AssignGuideToServicesAsync(
        AssignGuideToServicesRequest request,
        CancellationToken cancellationToken);

    Task ConfirmServiceGuideAsync(
        int resHolidayId,
        CancellationToken cancellationToken);

    Task UnassignGuideAsync(
        int resHolidayId,
        int guideId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Unassigns a guide from multiple services in a single batch operation.
    /// </summary>
    Task UnassignGuideBatchAsync(
        IReadOnlyList<int> resHolidayIds,
        int guideId,
        CancellationToken cancellationToken);

    Task MarkGuidePersonalBusyAsync(
        MarkGuidePersonalBusyRequest request,
        CancellationToken cancellationToken);
}
