using GuideManagement.Api.Models.Guides;
using GuideManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuideManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class GuidesController(IGuideRepository guideRepository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GuideDirectoryItemDto>>> GetGuides(CancellationToken cancellationToken)
    {
        var guides = await guideRepository.GetGuidesAsync(cancellationToken);
        return Ok(guides);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<GuideDetailDto>> GetGuide(int id, CancellationToken cancellationToken)
    {
        var guide = await guideRepository.GetGuideAsync(id, cancellationToken);
        return guide is null ? NotFound() : Ok(guide);
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateGuide([FromBody] GuideUpsertRequest request, CancellationToken cancellationToken)
    {
        var id = await guideRepository.CreateGuideAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetGuide), new { id }, new { id });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateGuide(int id, [FromBody] GuideUpsertRequest request, CancellationToken cancellationToken)
    {
        await guideRepository.UpdateGuideAsync(id, request, cancellationToken);
        return NoContent();
    }

    [HttpGet("meta/tags")]
    public async Task<ActionResult<IReadOnlyList<string>>> GetGuideClientTags(CancellationToken cancellationToken)
    {
        var tags = await guideRepository.GetGuideClientTagsAsync(cancellationToken);
        return Ok(tags);
    }

    [HttpPost("meta/tags")]
    public async Task<ActionResult<IReadOnlyList<string>>> CreateGuideClientTag(
        [FromBody] GuideClientTagRequest request,
        CancellationToken cancellationToken)
    {
        var tags = await guideRepository.CreateGuideClientTagAsync(request.Tag, cancellationToken);
        return Ok(tags);
    }

    [HttpGet("meta/cities")]
    public async Task<ActionResult<IReadOnlyList<CityOptionDto>>> GetCityOptions(CancellationToken cancellationToken)
    {
        var cities = await guideRepository.GetCityOptionsAsync(cancellationToken);
        return Ok(cities);
    }

    [HttpGet("meta/countries")]
    public async Task<ActionResult<IReadOnlyList<CountryOptionDto>>> GetCountryOptions(CancellationToken cancellationToken)
    {
        var countries = await guideRepository.GetCountryOptionsAsync(cancellationToken);
        return Ok(countries);
    }
}
