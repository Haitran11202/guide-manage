using System.ComponentModel.DataAnnotations;

namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class MarkGuidePersonalBusyRequest
{
    [Range(1, int.MaxValue)]
    public int GuideId { get; init; }

    public DateTime DateNghi { get; init; }

    [Required]
    [MaxLength(10)]
    public string CaNghi { get; init; } = "ALL";
}
