namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class AssignGuideToServiceResponse
{
    public int Pid { get; init; }
    public int ResHolidayXid { get; init; }
    public int SupplierGuideXid { get; init; }
    public int AssignStatus { get; init; }
    public int AssignedBy { get; init; }
    public DateTime AssignedDateUtc { get; init; }
    public string OperatorNote { get; init; } = string.Empty;
}
