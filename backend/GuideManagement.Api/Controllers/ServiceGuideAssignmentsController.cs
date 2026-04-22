using GuideManagement.Api.Models.ServiceGuideAssignments;
using GuideManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuideManagement.Api.Controllers;

[ApiController]
[Route("api/service-guide-assignments")]
public sealed class ServiceGuideAssignmentsController(IGuideAssignmentService guideAssignmentService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<AssignGuideToServiceResponse>> AssignGuideToService(
        [FromBody] AssignGuideToServiceRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await guideAssignmentService.AssignGuideToServiceAsync(request, cancellationToken);
            return Created($"/api/service-guide-assignments/{result.Pid}", result);
        }
        catch (GuideAssignmentConflictException exception)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Guide assignment conflict",
                Detail = exception.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Assignment target not found",
                Detail = exception.Message,
                Status = StatusCodes.Status404NotFound
            });
        }
    }
}
