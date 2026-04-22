using GuideManagement.Api.Models.ServiceGuideAssignments;

namespace GuideManagement.Api.Services;

public interface IGuideAssignmentService
{
    Task<AssignGuideToServiceResponse> AssignGuideToServiceAsync(
        AssignGuideToServiceRequest request,
        CancellationToken cancellationToken);
}
