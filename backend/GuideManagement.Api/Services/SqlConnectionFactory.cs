using GuideManagement.Api.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace GuideManagement.Api.Services;

public sealed class SqlConnectionFactory(IOptions<DatabaseOptions> options) : ISqlConnectionFactory
{
    private readonly string _connectionString = options.Value.ConnectionString;

    public SqlConnection CreateConnection()
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            throw new InvalidOperationException("Database connection string is missing. Set Database:ConnectionString in appsettings.");
        }

        return new SqlConnection(_connectionString);
    }
}
