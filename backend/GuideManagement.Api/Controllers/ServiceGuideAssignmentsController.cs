using GuideManagement.Api.Models.ServiceGuideAssignments;
using GuideManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuideManagement.Api.Controllers;

[ApiController]
[Route("api/service-guide-assignments")]
public sealed class ServiceGuideAssignmentsController(IGuideAssignmentService guideAssignmentService) : ControllerBase
{
    [HttpGet("available-guides")]
    public async Task<ActionResult<IReadOnlyList<AvailableGuideDto>>> SearchAvailableGuides(
        [FromQuery] DateTime arrDate,
        [FromQuery] string? maCa,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await guideAssignmentService.SearchAvailableGuidesAsync(arrDate, maCa, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid guide availability filter",
                Detail = exception.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                title: "Guide availability search failed",
                detail: exception.Message,
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }

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
        catch (ArgumentException exception)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid assignment request",
                Detail = exception.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                title: "Guide assignment failed",
                detail: exception.Message,
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    [HttpPost("confirm")]
    public async Task<IActionResult> ConfirmServiceGuide(
        [FromBody] ConfirmServiceGuideRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await guideAssignmentService.ConfirmServiceGuideAsync(request.ResHolidayId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Service not found",
                Detail = exception.Message,
                Status = StatusCodes.Status404NotFound
            });
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                title: "Service confirmation failed",
                detail: exception.Message,
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    [HttpDelete("{resHolidayId:int}/guides/{guideId:int}")]
    public async Task<IActionResult> UnassignGuide(
        int resHolidayId,
        int guideId,
        CancellationToken cancellationToken)
    {
        try
        {
            await guideAssignmentService.UnassignGuideAsync(resHolidayId, guideId, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                title: "Guide unassign failed",
                detail: exception.Message,
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    [HttpPost("busy-personal")]
    public async Task<IActionResult> MarkGuidePersonalBusy(
        [FromBody] MarkGuidePersonalBusyRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await guideAssignmentService.MarkGuidePersonalBusyAsync(request, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Guide not found",
                Detail = exception.Message,
                Status = StatusCodes.Status404NotFound
            });
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid busy request",
                Detail = exception.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                title: "Mark personal busy failed",
                detail: exception.Message,
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }
}
