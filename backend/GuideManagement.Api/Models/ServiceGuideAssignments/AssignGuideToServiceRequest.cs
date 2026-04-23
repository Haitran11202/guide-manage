using System.ComponentModel.DataAnnotations;

namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class AssignGuideToServiceRequest
{
    [Range(1, int.MaxValue)]
    public int ResHolidayXid { get; init; }

    [Range(1, int.MaxValue)]
    public int SupplierGuideXid { get; init; }

    [Range(1, int.MaxValue)]
    public int AssignedBy { get; init; }

    public DateTime? ArrDate { get; init; }

    [MaxLength(10)]
    public string MaCa { get; init; } = "ALL";

    [MaxLength(1000)]
    public string OperatorNote { get; init; } = string.Empty;
}
