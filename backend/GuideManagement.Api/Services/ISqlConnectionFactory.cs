using Microsoft.Data.SqlClient;

namespace GuideManagement.Api.Services;

public interface ISqlConnectionFactory
{
    SqlConnection CreateConnection();
}
