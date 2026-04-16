namespace GuideManagement.Api.Models.Guides;

public sealed class GuideDirectoryItemDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public bool PartTime { get; init; }
    public int Rating { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
}
