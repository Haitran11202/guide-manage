namespace GuideManagement.Api.Models.Guides;

public sealed class GuideCertificationDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public DateOnly? Expiry { get; init; }
    public string Org { get; init; } = string.Empty;
}
