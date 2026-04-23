namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class AssignGuideToServicesItemRequest
{
    public int ResHolidayXid { get; init; }
    public DateTime? ArrDate { get; init; }
}
