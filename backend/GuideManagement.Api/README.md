# GuideManagement.Api

ASP.NET Core Web API scaffold for the current frontend.

## Stack

- .NET 8
- ASP.NET Core Web API
- SQL Server 2012
- `Microsoft.Data.SqlClient`

## Config

Set the connection string in:

- `appsettings.json`
- or `appsettings.Development.json`

## Current schema assumptions

This scaffold assumes these SQL Server tables exist or will be created:

- `dbo.Guides`
- `dbo.Bookings`
- `dbo.BookingItemAssignments`
- `dbo.BookingItemTimeSlots`
- `dbo.GuideEmailRecords`
- `dbo.GuideTimeExceptions`

It also leaves room for:

- `dbo.GuideTags`
- `dbo.GuideLanguages`
- `dbo.GuideCertifications`
- `dbo.GuideBusyDates`

The exact frontend shape came from the existing mock data in `src/app/mock/types.ts`.

## Endpoints

- `GET /api/guides`
- `GET /api/guides/{id}`
- `POST /api/guides`
- `GET /api/timeline`

## Next step

Once the real SQL schema is available, replace the placeholder table/query assumptions in:

- `Services/GuideRepository.cs`
- `Services/TimelineRepository.cs`
