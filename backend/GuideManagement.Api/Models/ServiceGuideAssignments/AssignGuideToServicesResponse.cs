namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class AssignGuideToServicesResponse
{
    public int SupplierGuideXid { get; init; }
    public string MaCa { get; init; } = "ALL";
    public int AssignedBy { get; init; }
    public DateTime AssignedDateUtc { get; init; }
    public IReadOnlyList<AssignGuideToServiceResponse> Assignments { get; init; } = [];
}
