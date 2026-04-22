namespace GuideManagement.Api.Services;

public sealed class GuideAssignmentConflictException(string message) : Exception(message);
