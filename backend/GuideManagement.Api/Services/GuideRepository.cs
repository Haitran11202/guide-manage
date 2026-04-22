using GuideManagement.Api.Models.Guides;
using Microsoft.Data.SqlClient;

namespace GuideManagement.Api.Services;

public sealed class GuideRepository(ISqlConnectionFactory connectionFactory) : IGuideRepository
{
    private const int DefaultGuideCountryXid = 541;
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
                g.ExactCode,
                g.Appearance
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
            var appearance = reader.IsDBNull(6) ? string.Empty : reader.GetString(6).Trim();
            guides.Add(new GuideDirectoryItemDto
            {
                Id = reader.GetInt32(0),
                Name = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                Status = MapStatus(reader.IsDBNull(2) ? string.Empty : reader.GetString(2)),
                PartTime = MapPartTime(reader.IsDBNull(3) ? string.Empty : reader.GetString(3)),
                Rating = reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
                Tags = ParseAppearanceTags(appearance, exactCode)
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
                LTRIM(RTRIM(ISNULL(g.Address, ''))) AS Address,
                LTRIM(RTRIM(ISNULL(city.City, ''))) AS CityName,
                LTRIM(RTRIM(ISNULL(country.Country, ISNULL(g.CountryName, '')))) AS CountryName,
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
                g.History,
                g.Notes,
                g.TaxCode,
                g.BankName,
                g.BankAccountNumber,
                g.BankAccountName,
                g.Appearance,
                ISNULL(tours.TotalTours, 0) AS TotalTours,
                wht.WHTType,
                (wht.WHTRate * 100.0) AS WHTRate
            FROM dbo.M_SupplierGuide g
            LEFT JOIN dbo.M_City city
                ON city.Pid = g.CityXid
            LEFT JOIN dbo.M_Country country
                ON country.Pid = g.CountryXid
            OUTER APPLY
            (
                SELECT COUNT(1) AS TotalTours
                FROM dbo.Res_holidayGuide rhg
                WHERE rhg.SupplierGuideXid = g.Pid
            ) tours
            OUTER APPLY
            (
                SELECT TOP (1)
                    sgw.WHTType,
                    sgw.WHTRate 
                FROM dbo.M_SupplierGuide_WHT sgw
                WHERE sgw.SupplierGuideXid = g.Pid
                ORDER BY
                    sgw.WHTValidFrom DESC,
                    sgw.LastEdit DESC,
                    sgw.Pid DESC
            ) wht
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

        var guideId = reader.GetInt32(0);
        var guideName = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
        var email = reader.IsDBNull(2) ? string.Empty : reader.GetString(2);
        var phone = reader.IsDBNull(3) ? string.Empty : reader.GetString(3);
        DateOnly? dateOfBirth = reader.IsDBNull(4) ? null : DateOnly.FromDateTime(reader.GetDateTime(4));
        var address = reader.IsDBNull(5) ? string.Empty : reader.GetString(5);
        var city = reader.IsDBNull(6) ? string.Empty : reader.GetString(6);
        var country = reader.IsDBNull(7) ? string.Empty : reader.GetString(7);
        var status = MapStatus(reader.IsDBNull(8) ? string.Empty : reader.GetString(8));
        var partTime = MapPartTime(reader.IsDBNull(9) ? string.Empty : reader.GetString(9));
        var rating = reader.IsDBNull(10) ? 0 : reader.GetInt32(10);
        var licenseName = reader.IsDBNull(11) ? string.Empty : reader.GetString(11);
        DateOnly? startDateWithUs = reader.IsDBNull(12) ? null : DateOnly.FromDateTime(reader.GetDateTime(12));
        var exactCode = reader.IsDBNull(13) ? string.Empty : reader.GetString(13).Trim();
        var languageSkill = reader.IsDBNull(14) ? string.Empty : reader.GetString(14).Trim();
        var baseLanguageXid = reader.IsDBNull(15) ? (int?)null : reader.GetInt32(15);
        var notes = reader.IsDBNull(22) ? string.Empty : reader.GetString(22).Trim();
        var taxCode = reader.IsDBNull(23) ? string.Empty : reader.GetString(23).Trim();
        var bankName = reader.IsDBNull(24) ? string.Empty : reader.GetString(24).Trim();
        var bankAccountNumber = reader.IsDBNull(25) ? string.Empty : reader.GetString(25).Trim();
        var bankAccountName = reader.IsDBNull(26) ? string.Empty : reader.GetString(26).Trim();
        var appearance = reader.IsDBNull(27) ? string.Empty : reader.GetString(27).Trim();
        var totalTours = reader.IsDBNull(28) ? 0 : reader.GetInt32(28);
        var whtType = reader.IsDBNull(29) ? "Resident" : reader.GetString(29).Trim();
        var whtTax = reader.IsDBNull(30) ? 10.21m : reader.GetDecimal(30);

        var bio = new List<string>();
        AddIfHasValue(bio, reader.IsDBNull(18) ? string.Empty : reader.GetString(18));
        if (bio.Count == 0)
        {
            bio.Add("Guide profile synced from M_SupplierGuide.");
        }

        var tourRecordParts = new List<string>();
        AddIfHasValue(tourRecordParts, reader.IsDBNull(16) ? string.Empty : reader.GetString(16));
        AddIfHasValue(tourRecordParts, reader.IsDBNull(17) ? string.Empty : reader.GetString(17));
        await reader.DisposeAsync();

        var languages = await GetGuideLanguagesAsync(id, connection, null, cancellationToken);
        if (languages.Count == 0)
        {
            languages = await BuildFallbackLanguagesAsync(baseLanguageXid, languageSkill, connection, null, cancellationToken);
        }

        return new GuideDetailDto
        {
            Id = guideId,
            Name = guideName,
            Email = email,
            Phone = phone,
            DateOfBirth = dateOfBirth,
            Address = address,
            City = city,
            Country = country,
            Avatar = string.Empty,
            Status = status,
            PartTime = partTime,
            Rating = rating,
            WhtType = whtType,
            WhtTax = whtTax,
            TourRecord = tourRecordParts.Count == 0 ? string.Empty : string.Join("\n", tourRecordParts),
            LicenseName = licenseName,
            StartDateWithUs = startDateWithUs,
            HistoricalTours = totalTours,
            AverageRating = 0m,
            YearsExperience = CalculateYearsExperience(startDateWithUs?.ToDateTime(TimeOnly.MinValue)),
            Appearance = appearance,
            Notes = notes,
            TaxCode = taxCode,
            BankName = bankName,
            BankAccountNumber = bankAccountNumber,
            BankAccountName = bankAccountName,
            Tags = ParseAppearanceTags(appearance, string.Empty),
            Languages = languages,
            Certifications = BuildCertifications(licenseName),
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
                CityXid,
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
                Appearance,
                Notes,
                TaxCode,
                BankName,
                BankAccountNumber,
                BankAccountName,
                CountryXid,
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
                @CityXid,
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
                @Appearance,
                @Notes,
                @TaxCode,
                @BankName,
                @BankAccountNumber,
                @BankAccountName,
                @CountryXid,
                @CountryName,
                @Aboutme,
                @ExperienceAndAchievements,
                @PersonalInterests
            );
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Transaction = transaction;
        BindGuideUpsertParameters(command, request);
        await SetResolvedCityAsync(command, request.City, connection, transaction, cancellationToken);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        var guideId = Convert.ToInt32(result);
        await SaveGuideLanguagesAsync(guideId, request.Languages, connection, transaction, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return guideId;
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
                CityXid = @CityXid,
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
                Appearance = @Appearance,
                Notes = @Notes,
                TaxCode = @TaxCode,
                BankName = @BankName,
                BankAccountNumber = @BankAccountNumber,
                BankAccountName = @BankAccountName,
                CountryXid = @CountryXid,
                CountryName = @CountryName,
                Aboutme = @Aboutme,
                ExperienceAndAchievements = @ExperienceAndAchievements,
                PersonalInterests = @PersonalInterests
            WHERE Pid = @Id;
            """;

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Transaction = transaction;
        BindGuideUpsertParameters(command, request);
        await SetResolvedCityAsync(command, request.City, connection, transaction, cancellationToken);
        command.Parameters.AddWithValue("@Id", id);
        await command.ExecuteNonQueryAsync(cancellationToken);
        await SaveGuideLanguagesAsync(id, request.Languages, connection, transaction, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetGuideClientTagsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                g.Appearance,
                g.ExactCode
            FROM dbo.M_SupplierGuide g
            WHERE
                (g.Appearance IS NOT NULL AND LTRIM(RTRIM(g.Appearance)) <> '')
                OR (g.ExactCode IS NOT NULL AND LTRIM(RTRIM(g.ExactCode)) <> '')
            ORDER BY g.Appearance, g.ExactCode;
            """;

        var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var appearance = reader.IsDBNull(0) ? string.Empty : reader.GetString(0);
            var exactCode = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
            foreach (var tag in ParseAppearanceTags(appearance, exactCode))
            {
                tags.Add(tag);
            }
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
                LTRIM(RTRIM(ISNULL(city.City, ''))) AS City,
                LTRIM(RTRIM(ISNULL(country.Country, ''))) AS Country
            FROM dbo.M_City city
            LEFT JOIN dbo.M_Country country
                ON country.Pid = city.CountryXid
            WHERE city.City IS NOT NULL
              AND LTRIM(RTRIM(city.City)) <> ''
              AND city.CountryXid = @CountryXid
            ORDER BY City;
            """;

        var result = new List<CityOptionDto>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@CountryXid", DefaultGuideCountryXid);
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

    public async Task<IReadOnlyList<CountryOptionDto>> GetCountryOptionsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                c.Pid,
                LTRIM(RTRIM(c.Country)) AS CountryName
            FROM dbo.M_Country c
            WHERE c.Pid IS NOT NULL
              AND c.Country IS NOT NULL
              AND LTRIM(RTRIM(c.Country)) <> ''
            ORDER BY CountryName;
            """;

        var result = new List<CountryOptionDto>();

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new CountryOptionDto
            {
                Xid = reader.GetInt32(0),
                Name = reader.IsDBNull(1) ? string.Empty : reader.GetString(1)
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
        command.Parameters.AddWithValue("@CityXid", DBNull.Value);
        command.Parameters.AddWithValue("@Address", request.Address.Trim());
        command.Parameters.AddWithValue("@GuideRank", request.Rating);
        command.Parameters.AddWithValue("@GuideLicense", request.LicenseName.Trim());
        command.Parameters.AddWithValue("@BirthDay", request.DateOfBirth?.ToDateTime(TimeOnly.MinValue) ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@StartDateWithBT", request.StartDateWithUs?.ToDateTime(TimeOnly.MinValue) ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Languageskill", request.Languages.FirstOrDefault()?.Level ?? string.Empty);
        command.Parameters.AddWithValue("@DestinationsKnowledge", request.TourRecord.Trim());
        command.Parameters.AddWithValue("@ExpertiseExperience", string.Empty);
        command.Parameters.AddWithValue("@ExactCode", request.Tags.FirstOrDefault() ?? string.Empty);
        command.Parameters.AddWithValue("@Appearance", request.Appearance.Trim());
        command.Parameters.AddWithValue("@Notes", request.Notes.Trim());
        command.Parameters.AddWithValue("@TaxCode", request.TaxCode.Trim());
        command.Parameters.AddWithValue("@BankName", request.BankName.Trim());
        command.Parameters.AddWithValue("@BankAccountNumber", request.BankAccountNumber.Trim());
        command.Parameters.AddWithValue("@BankAccountName", request.BankAccountName.Trim());
        command.Parameters.AddWithValue("@CountryXid", DBNull.Value);
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

    private static async Task SetResolvedCityAsync(
        SqlCommand command,
        string cityName,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        var cityInfo = await ResolveCityInfoAsync(cityName, connection, transaction, cancellationToken);
        command.Parameters["@CityXid"].Value = cityInfo is null ? DBNull.Value : cityInfo.CityXid;
        command.Parameters["@CountryXid"].Value = cityInfo?.CountryXid ?? DefaultGuideCountryXid;
        command.Parameters["@CountryName"].Value = string.IsNullOrWhiteSpace(cityInfo?.CountryName)
            ? await GetCountryNameAsync(DefaultGuideCountryXid, connection, transaction, cancellationToken)
            : cityInfo.CountryName;
    }

    private async Task<IReadOnlyList<GuideLanguageDto>> GetGuideLanguagesAsync(
        int guideId,
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                LTRIM(RTRIM(ISNULL(lang.LanguageName, ''))) AS LanguageName,
                LTRIM(RTRIM(ISNULL(sgl.LanguageSkill, ''))) AS LanguageSkill
            FROM dbo.M_SupplierGuideLanguage sgl
            LEFT JOIN dbo.M_Language lang
                ON lang.Pid = sgl.LanguageXid
            WHERE sgl.SupplierGuideXid = @GuideId
            ORDER BY sgl.Pid;
            """;

        var languages = new List<GuideLanguageDto>();
        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("@GuideId", guideId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var languageName = reader.IsDBNull(0) ? string.Empty : reader.GetString(0).Trim();
            var languageSkill = reader.IsDBNull(1) ? string.Empty : reader.GetString(1).Trim();
            if (string.IsNullOrWhiteSpace(languageName) && string.IsNullOrWhiteSpace(languageSkill))
            {
                continue;
            }

            languages.Add(new GuideLanguageDto
            {
                Language = string.IsNullOrWhiteSpace(languageName) ? "Language" : languageName,
                Level = string.IsNullOrWhiteSpace(languageSkill) ? "N/A" : languageSkill
            });
        }

        return languages;
    }

    private async Task<IReadOnlyList<GuideLanguageDto>> BuildFallbackLanguagesAsync(
        int? languageXid,
        string languageSkill,
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (!languageXid.HasValue && string.IsNullOrWhiteSpace(languageSkill))
        {
            return [];
        }

        var languageName = languageXid.HasValue
            ? await GetLanguageNameAsync(languageXid.Value, connection, transaction, cancellationToken)
            : string.Empty;

        if (string.IsNullOrWhiteSpace(languageName) && string.IsNullOrWhiteSpace(languageSkill))
        {
            return [];
        }

        return
        [
            new GuideLanguageDto
            {
                Language = string.IsNullOrWhiteSpace(languageName) ? "Language" : languageName,
                Level = string.IsNullOrWhiteSpace(languageSkill) ? "N/A" : languageSkill
            }
        ];
    }

    private async Task SaveGuideLanguagesAsync(
        int guideId,
        IReadOnlyList<GuideLanguageDto> languages,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string deleteSql = """
            DELETE FROM dbo.M_SupplierGuideLanguage
            WHERE SupplierGuideXid = @GuideId;
            """;
        const string insertSql = """
            INSERT INTO dbo.M_SupplierGuideLanguage
            (
                SupplierGuideXid,
                LanguageXid,
                LanguageSkill
            )
            VALUES
            (
                @GuideId,
                @LanguageXid,
                @LanguageSkill
            );
            """;

        await using (var deleteCommand = new SqlCommand(deleteSql, connection, transaction))
        {
            deleteCommand.Parameters.AddWithValue("@GuideId", guideId);
            await deleteCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        var validLanguages = languages
            .Where(static language => !string.IsNullOrWhiteSpace(language.Language) || !string.IsNullOrWhiteSpace(language.Level))
            .ToArray();
        if (validLanguages.Length == 0)
        {
            return;
        }

        foreach (var language in validLanguages)
        {
            var languageXid = await ResolveLanguageXidAsync(language.Language, connection, transaction, cancellationToken);
            if (!languageXid.HasValue)
            {
                continue;
            }

            await using var insertCommand = new SqlCommand(insertSql, connection, transaction);
            insertCommand.Parameters.AddWithValue("@GuideId", guideId);
            insertCommand.Parameters.AddWithValue("@LanguageXid", languageXid.Value);
            insertCommand.Parameters.AddWithValue("@LanguageSkill", string.IsNullOrWhiteSpace(language.Level) ? (object)DBNull.Value : language.Level.Trim());
            await insertCommand.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task<string> GetLanguageNameAsync(
        int languageXid,
        SqlConnection connection,
        SqlTransaction? transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) LTRIM(RTRIM(ISNULL(lang.LanguageName, '')))
            FROM dbo.M_Language lang
            WHERE lang.Pid = @LanguageXid;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("@LanguageXid", languageXid);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is string value ? value.Trim() : string.Empty;
    }

    private static async Task<int?> ResolveLanguageXidAsync(
        string languageName,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(languageName))
        {
            return null;
        }

        const string sql = """
            SELECT TOP (1) lang.Pid
            FROM dbo.M_Language lang
            WHERE LTRIM(RTRIM(ISNULL(lang.LanguageName, ''))) = @LanguageName
            ORDER BY lang.Pid;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("@LanguageName", languageName.Trim());
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is null or DBNull ? null : Convert.ToInt32(result);
    }

    private sealed record ResolvedCityInfo(int CityXid, int CountryXid, string CountryName);

    private static async Task<ResolvedCityInfo?> ResolveCityInfoAsync(
        string cityName,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(cityName))
        {
            return null;
        }

        const string sql = """
            SELECT TOP (1)
                city.Pid,
                ISNULL(city.CountryXid, @CountryXid) AS CountryXid,
                LTRIM(RTRIM(ISNULL(country.Country, ''))) AS CountryName
            FROM dbo.M_City city
            LEFT JOIN dbo.M_Country country
                ON country.Pid = city.CountryXid
            WHERE LTRIM(RTRIM(ISNULL(city.City, ''))) = @CityName
              AND city.CountryXid = @CountryXid
            ORDER BY city.Pid;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("@CityName", cityName.Trim());
        command.Parameters.AddWithValue("@CountryXid", DefaultGuideCountryXid);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new ResolvedCityInfo(
            reader.GetInt32(0),
            reader.IsDBNull(1) ? DefaultGuideCountryXid : reader.GetInt32(1),
            reader.IsDBNull(2) ? string.Empty : reader.GetString(2).Trim());
    }

    private static async Task<string> GetCountryNameAsync(
        int countryXid,
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) LTRIM(RTRIM(ISNULL(country.Country, '')))
            FROM dbo.M_Country country
            WHERE country.Pid = @CountryXid;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("@CountryXid", countryXid);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is string value ? value.Trim() : string.Empty;
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

    private static IReadOnlyList<string> ParseAppearanceTags(string appearance, string fallbackTag = "")
    {
        var tags = appearance
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(static value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (tags.Length > 0)
        {
            return tags;
        }

        return string.IsNullOrWhiteSpace(fallbackTag) ? [] : [fallbackTag.Trim()];
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
