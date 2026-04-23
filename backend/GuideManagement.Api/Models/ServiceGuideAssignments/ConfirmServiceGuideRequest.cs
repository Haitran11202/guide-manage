using System.ComponentModel.DataAnnotations;

namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class ConfirmServiceGuideRequest
{
    [Range(1, int.MaxValue)]
    public int ResHolidayId { get; init; }
}
