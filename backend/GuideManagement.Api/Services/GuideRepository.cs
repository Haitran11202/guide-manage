using GuideManagement.Api.Models.Guides;
using Microsoft.Data.SqlClient;

namespace GuideManagement.Api.Services;

public sealed class GuideRepository(ISqlConnectionFactory connectionFactory) : IGuideRepository
{
    private static readonly object CustomTagsLock = new();
    private static readonly HashSet<string> CustomTags = new(StringComparer.OrdinalIgnoreCase);

    public async Task<IReadOnlyList<GuideDirectoryItemDto>> GetGuidesAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                g.Pid,
                g.Guide,
                g.OnOff,
                g.Partime,
                g.GuideRank,
                g.ExactCode
            FROM dbo.M_SupplierGuide g
            ORDER BY g.Guide;
            """;

        var guides = new List<GuideDirectoryItemDto>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var exactCode = reader.IsDBNull(5) ? string.Empty : reader.GetString(5).Trim();
            guides.Add(new GuideDirectoryItemDto
            {
                Id = reader.GetInt32(0),
                Name = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                Status = MapStatus(reader.IsDBNull(2) ? string.Empty : reader.GetString(2)),
                PartTime = MapPartTime(reader.IsDBNull(3) ? string.Empty : reader.GetString(3)),
                Rating = reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
                Tags = string.IsNullOrWhiteSpace(exactCode) ? [] : [exactCode]
            });
        }

        return guides;
    }

    public async Task<GuideDetailDto?> GetGuideAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1)
                g.Pid,
                g.Guide,
                g.Email,
                g.Phone,
                g.BirthDay,
                g.Address,
                g.CountryName,
                g.OnOff,
                g.Partime,
                g.GuideRank,
                g.GuideLicense,
                g.StartDateWithBT,
                g.ExactCode,
                g.Languageskill,
                g.LanguageXid,
                g.DestinationsKnowledge,
                g.ExpertiseExperience,
                g.Aboutme,
                g.ExperienceAndAchievements,
                g.PersonalInterests,
                g.History
            FROM dbo.M_SupplierGuide g
            WHERE g.Pid = @Id;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@Id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var exactCode = reader.IsDBNull(12) ? string.Empty : reader.GetString(12).Trim();
        var languageSkill = reader.IsDBNull(13) ? string.Empty : reader.GetString(13).Trim();
        var languageXid = reader.IsDBNull(14) ? (int?)null : reader.GetInt32(14);

        var bio = new List<string>();
        AddIfHasValue(bio, reader.IsDBNull(17) ? string.Empty : reader.GetString(17));
        AddIfHasValue(bio, reader.IsDBNull(18) ? string.Empty : reader.GetString(18));
        AddIfHasValue(bio, reader.IsDBNull(19) ? string.Empty : reader.GetString(19));
        if (bio.Count == 0)
        {
            bio.Add("Guide profile synced from M_SupplierGuide.");
        }

        var tourRecordParts = new List<string>();
        AddIfHasValue(tourRecordParts, reader.IsDBNull(15) ? string.Empty : reader.GetString(15));
        AddIfHasValue(tourRecordParts, reader.IsDBNull(16) ? string.Empty : reader.GetString(16));

        return new GuideDetailDto
        {
            Id = reader.GetInt32(0),
            Name = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
            Email = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
            Phone = reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
            DateOfBirth = reader.IsDBNull(4) ? null : DateOnly.FromDateTime(reader.GetDateTime(4)),
            City = reader.IsDBNull(5) ? string.Empty : reader.GetString(5),
            Country = reader.IsDBNull(6) ? string.Empty : reader.GetString(6),
            Avatar = string.Empty,
            Status = MapStatus(reader.IsDBNull(7) ? string.Empty : reader.GetString(7)),
            PartTime = MapPartTime(reader.IsDBNull(8) ? string.Empty : reader.GetString(8)),
            Rating = reader.IsDBNull(9) ? 0 : reader.GetInt32(9),
            WhtType = "Resident",
            WhtTax = 10.21m,
            TourRecord = tourRecordParts.Count == 0 ? string.Empty : string.Join("\n", tourRecordParts),
            LicenseName = reader.IsDBNull(10) ? string.Empty : reader.GetString(10),
            StartDateWithUs = reader.IsDBNull(11) ? null : DateOnly.FromDateTime(reader.GetDateTime(11)),
            HistoricalTours = reader.IsDBNull(20) ? 0 : reader.GetInt32(20),
            AverageRating = 0m,
            YearsExperience = CalculateYearsExperience(reader.IsDBNull(11) ? null : reader.GetDateTime(11)),
            Tags = string.IsNullOrWhiteSpace(exactCode) ? [] : [exactCode],
            Languages = BuildLanguages(languageXid, languageSkill),
            Certifications = BuildCertifications(reader.IsDBNull(10) ? string.Empty : reader.GetString(10)),
            Bio = bio
        };
    }

    public async Task<int> CreateGuideAsync(GuideUpsertRequest request, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.M_SupplierGuide
            (
                SupplierXid,
                Guide,
                LanguageXid,
                Partime,
                OnOff,
                Phone,
                Email,
                Address,
                LastEdit,
                GuideRank,
                GuideLicense,
                BirthDay,
                StartDateWithBT,
                Languageskill,
                DestinationsKnowledge,
                ExpertiseExperience,
                ExactCode,
                CountryName,
                Aboutme,
                ExperienceAndAchievements,
                PersonalInterests
            )
            OUTPUT INSERTED.Pid
            VALUES
            (
                @SupplierXid,
                @Guide,
                @LanguageXid,
                @Partime,
                @OnOff,
                @Phone,
                @Email,
                @Address,
                GETDATE(),
                @GuideRank,
                @GuideLicense,
                @BirthDay,
                @StartDateWithBT,
                @Languageskill,
                @DestinationsKnowledge,
                @ExpertiseExperience,
                @ExactCode,
                @CountryName,
                @Aboutme,
                @ExperienceAndAchievements,
                @PersonalInterests
            );
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        BindGuideUpsertParameters(command, request);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result);
    }

    public async Task UpdateGuideAsync(int id, GuideUpsertRequest request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE dbo.M_SupplierGuide
            SET
                Guide = @Guide,
                LanguageXid = @LanguageXid,
                Partime = @Partime,
                OnOff = @OnOff,
                Phone = @Phone,
                Email = @Email,
                Address = @Address,
                LastEdit = GETDATE(),
                GuideRank = @GuideRank,
                GuideLicense = @GuideLicense,
                BirthDay = @BirthDay,
                StartDateWithBT = @StartDateWithBT,
                Languageskill = @Languageskill,
                DestinationsKnowledge = @DestinationsKnowledge,
                ExpertiseExperience = @ExpertiseExperience,
                ExactCode = @ExactCode,
                CountryName = @CountryName,
                Aboutme = @Aboutme,
                ExperienceAndAchievements = @ExperienceAndAchievements,
                PersonalInterests = @PersonalInterests
            WHERE Pid = @Id;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        BindGuideUpsertParameters(command, request);
        command.Parameters.AddWithValue("@Id", id);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetGuideClientTagsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT DISTINCT g.ExactCode
            FROM dbo.M_SupplierGuide g
            WHERE g.ExactCode IS NOT NULL AND LTRIM(RTRIM(g.ExactCode)) <> ''
            ORDER BY g.ExactCode;
            """;

        var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            tags.Add(reader.GetString(0).Trim());
        }

        lock (CustomTagsLock)
        {
            foreach (var tag in CustomTags)
            {
                tags.Add(tag);
            }
        }

        return tags.OrderBy(value => value).ToArray();
    }

    public async Task<IReadOnlyList<string>> CreateGuideClientTagAsync(string tag, CancellationToken cancellationToken)
    {
        var normalizedTag = tag.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(normalizedTag))
        {
            lock (CustomTagsLock)
            {
                CustomTags.Add(normalizedTag);
            }
        }

        return await GetGuideClientTagsAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CityOptionDto>> GetCityOptionsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT DISTINCT
                CASE
                    WHEN g.Address IS NOT NULL AND LTRIM(RTRIM(g.Address)) <> '' THEN LTRIM(RTRIM(g.Address))
                    WHEN g.CityXid IS NOT NULL THEN 'City ' + CAST(g.CityXid AS varchar(20))
                    ELSE ''
                END AS City,
                ISNULL(g.CountryName, '') AS Country
            FROM dbo.M_SupplierGuide g
            WHERE
                (g.Address IS NOT NULL AND LTRIM(RTRIM(g.Address)) <> '')
                OR g.CityXid IS NOT NULL
            ORDER BY City;
            """;

        var result = new List<CityOptionDto>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new CityOptionDto
            {
                City = reader.IsDBNull(0) ? string.Empty : reader.GetString(0),
                Country = reader.IsDBNull(1) ? string.Empty : reader.GetString(1)
            });
        }

        return result;
    }

    private static void BindGuideUpsertParameters(SqlCommand command, GuideUpsertRequest request)
    {
        command.Parameters.AddWithValue("@SupplierXid", 0);
        command.Parameters.AddWithValue("@Guide", request.Name.Trim());
        command.Parameters.AddWithValue("@LanguageXid", ParseLanguageXid(request));
        command.Parameters.AddWithValue("@Partime", request.PartTime ? "Y" : "N");
        command.Parameters.AddWithValue("@OnOff", string.Equals(request.Status, "Active", StringComparison.OrdinalIgnoreCase) ? "ON" : "OFF");
        command.Parameters.AddWithValue("@Phone", request.Phone.Trim());
        command.Parameters.AddWithValue("@Email", request.Email.Trim());
        command.Parameters.AddWithValue("@Address", request.City.Trim());
        command.Parameters.AddWithValue("@GuideRank", request.Rating);
        command.Parameters.AddWithValue("@GuideLicense", request.LicenseName.Trim());
        command.Parameters.AddWithValue("@BirthDay", request.DateOfBirth?.ToDateTime(TimeOnly.MinValue) ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@StartDateWithBT", request.StartDateWithUs?.ToDateTime(TimeOnly.MinValue) ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Languageskill", request.Languages.FirstOrDefault()?.Level ?? string.Empty);
        command.Parameters.AddWithValue("@DestinationsKnowledge", request.TourRecord.Trim());
        command.Parameters.AddWithValue("@ExpertiseExperience", request.TourRecord.Trim());
        command.Parameters.AddWithValue("@ExactCode", request.Tags.FirstOrDefault() ?? string.Empty);
        command.Parameters.AddWithValue("@CountryName", request.Country.Trim());
        command.Parameters.AddWithValue("@Aboutme", request.Bio.FirstOrDefault() ?? string.Empty);
        command.Parameters.AddWithValue("@ExperienceAndAchievements", request.Bio.Skip(1).FirstOrDefault() ?? string.Empty);
        command.Parameters.AddWithValue("@PersonalInterests", request.Bio.Skip(2).FirstOrDefault() ?? string.Empty);
    }

    private static int ParseLanguageXid(GuideUpsertRequest request)
    {
        var raw = request.Languages.FirstOrDefault()?.Language;
        return int.TryParse(raw, out var value) ? value : 0;
    }

    private static IReadOnlyList<GuideLanguageDto> BuildLanguages(int? languageXid, string languageSkill)
    {
        if (!languageXid.HasValue && string.IsNullOrWhiteSpace(languageSkill))
        {
            return [];
        }

        return
        [
            new GuideLanguageDto
            {
                Language = languageXid.HasValue ? $"Language {languageXid.Value}" : "Language",
                Level = string.IsNullOrWhiteSpace(languageSkill) ? "N/A" : languageSkill
            }
        ];
    }

    private static IReadOnlyList<GuideCertificationDto> BuildCertifications(string guideLicense)
    {
        if (string.IsNullOrWhiteSpace(guideLicense))
        {
            return [];
        }

        return
        [
            new GuideCertificationDto
            {
                Id = $"license-{guideLicense.Trim().ToLowerInvariant().Replace(' ', '-')}",
                Name = guideLicense.Trim(),
                Org = "",
                Expiry = null
            }
        ];
    }

    private static void AddIfHasValue(List<string> target, string value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            target.Add(value.Trim());
        }
    }

    private static string MapStatus(string onOff)
    {
        var normalized = onOff.Trim().ToUpperInvariant();
        return normalized is "ON" or "Y" ? "Active" : "Inactive";
    }

    private static bool MapPartTime(string partime)
    {
        var normalized = partime.Trim().ToUpperInvariant();
        return normalized is "Y" or "1" or "T";
    }

    private static int CalculateYearsExperience(DateTime? startDateWithBt)
    {
        if (!startDateWithBt.HasValue)
        {
            return 0;
        }

        var now = DateTime.UtcNow.Date;
        var start = startDateWithBt.Value.Date;
        var years = now.Year - start.Year;
        if (start > now.AddYears(-years))
        {
            years -= 1;
        }

        return Math.Max(0, years);
    }
}
