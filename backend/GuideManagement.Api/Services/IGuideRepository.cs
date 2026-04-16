using GuideManagement.Api.Models.Guides;

namespace GuideManagement.Api.Services;

public interface IGuideRepository
{
    Task<IReadOnlyList<GuideDirectoryItemDto>> GetGuidesAsync(CancellationToken cancellationToken);
    Task<GuideDetailDto?> GetGuideAsync(int id, CancellationToken cancellationToken);
    Task<int> CreateGuideAsync(GuideUpsertRequest request, CancellationToken cancellationToken);
    Task UpdateGuideAsync(int id, GuideUpsertRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> GetGuideClientTagsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> CreateGuideClientTagAsync(string tag, CancellationToken cancellationToken);
    Task<IReadOnlyList<CityOptionDto>> GetCityOptionsAsync(CancellationToken cancellationToken);
}
