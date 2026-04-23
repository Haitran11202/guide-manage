using System.ComponentModel.DataAnnotations;

namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class SearchAvailableGuidesRequest
{
    public IReadOnlyList<DateTime> ArrDates { get; init; } = [];

    [MaxLength(10)]
    public string MaCa { get; init; } = "ALL";
}
