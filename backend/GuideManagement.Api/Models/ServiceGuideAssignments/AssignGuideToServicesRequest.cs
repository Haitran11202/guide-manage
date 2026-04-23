namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class AssignGuideToServicesRequest
{
    public int SupplierGuideXid { get; init; }
    public IReadOnlyList<AssignGuideToServicesItemRequest> Items { get; init; } = [];
    public string? MaCa { get; init; }
    public string? OperatorNote { get; init; }
    public int AssignedBy { get; init; }
}
