namespace GuideManagement.Api.Models.ServiceGuideAssignments;

public sealed class AvailableGuideDto
{
    public int GuideId { get; init; }
    public string GuideName { get; init; } = string.Empty;
    public IReadOnlyList<string> BusyShiftCodes { get; init; } = [];
    public IReadOnlyList<string> AvailableShiftCodes { get; init; } = [];
}
