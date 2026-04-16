namespace GuideManagement.Api.Models.Guides;

public sealed class GuideDetailDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public DateOnly? DateOfBirth { get; init; }
    public string City { get; init; } = string.Empty;
    public string Country { get; init; } = string.Empty;
    public string Avatar { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public bool PartTime { get; init; }
    public int Rating { get; init; }
    public string WhtType { get; init; } = string.Empty;
    public decimal WhtTax { get; init; }
    public string TourRecord { get; init; } = string.Empty;
    public string LicenseName { get; init; } = string.Empty;
    public DateOnly? StartDateWithUs { get; init; }
    public int HistoricalTours { get; init; }
    public decimal AverageRating { get; init; }
    public int YearsExperience { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public IReadOnlyList<GuideLanguageDto> Languages { get; init; } = [];
    public IReadOnlyList<GuideCertificationDto> Certifications { get; init; } = [];
    public IReadOnlyList<string> Bio { get; init; } = [];
}
