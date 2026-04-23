namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class UnassignGuideBatchRequest
{
    /// <summary>
    /// The list of ResHoliday IDs to unassign the guide from.
    /// </summary>
    public IReadOnlyList<int> ResHolidayIds { get; init; } = [];
}
