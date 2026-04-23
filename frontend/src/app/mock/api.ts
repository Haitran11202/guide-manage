import type {
  AvailableGuide,
  AssignGuideToServiceRequest,
  AssignGuideToServiceResponse,
  AssignGuideToServicesRequest,
  AssignGuideToServicesResponse,
  BookingManagerData,
  CityOption,
  CountryOption,
  GuideBookingShift,
  GuideDirectoryItem,
  GuideEmailRecord,
  GuideFormData,
  GuideProfileData,
  ServiceDayPart,
  ShiftCode,
  TimelineBookingSeries,
  TimelineData,
  WhtType,
} from "./types";

export const GUIDE_DIRECTORY_TAGS = ["CEO", "CEO-NAT", "CEO-GEO", "LUXE", "HMA", "RBT", "NRV"];
export const GUIDE_FORM_TAGS = [...GUIDE_DIRECTORY_TAGS, "MICE", "VIP-CORP"];
export const LANGUAGE_OPTIONS = ["English", "French", "Spanish", "German", "Italian", "Mandarin", "Japanese"];
export const PROFICIENCY_LEVELS = ["Basic", "Fluent", "Intermediate"];
export const SERVICE_DAY_PARTS: ServiceDayPart[] = ["full-day", "morning", "afternoon", "evening"];

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop";

type ApiGuideDirectoryItem = {
  id: number;
  name: string;
  status: string;
  partTime: boolean;
  rating: number;
  tags: string[];
};

type ApiGuideLanguage = {
  language: string;
  level: string;
};

type ApiGuideCertification = {
  id: string;
  name: string;
  expiry?: string | null;
  org?: string;
};

type ApiGuideDetail = {
  id: number;
  name: string;
  email: string;
  phone: string;
  dateOfBirth?: string | null;
  address: string;
  city: string;
  country: string;
  avatar: string;
  status: string;
  partTime: boolean;
  rating: number;
  whtType: string;
  whtTax: number;
  tourRecord: string;
  notes: string;
  licenseName: string;
  startDateWithUs?: string | null;
  historicalTours: number;
  averageRating: number;
  yearsExperience: number;
  appearance?: string;
  notes?: string;
  taxCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  tags: string[];
  languages: ApiGuideLanguage[];
  certifications: ApiGuideCertification[];
  bio: string[];
};

type ApiCountryOption = {
  xid: number;
  name: string;
};

type ApiGuideEmailRecord = {
  bookingId: string;
  guideId: number;
  status: "draft" | "sent";
  date?: string | null;
  subject: string;
  body: string;
};

type ApiGuideTimeException = {
  id: string;
  bookingId: string;
  guideId: number;
  date?: string | null;
  startHour: number;
  endHour: number;
};

type ApiGuideBookingShift = {
  date?: string | null;
  shift?: string | null;
};

type ApiBusyDate = {
  id: string;
  from?: string | null;
  to?: string | null;
};

type ApiAssignGuideToServiceResponse = {
  pid: number;
  resHolidayXid: number;
  supplierGuideXid: number;
  arrDate: string;
  maCa: ShiftCode;
  busyStatus: string;
  assignStatus: number;
  assignedBy: number;
  assignedDateUtc: string;
  operatorNote: string;
};

type ApiAssignGuideToServicesResponse = {
  supplierGuideXid: number;
  maCa: ShiftCode;
  assignedBy: number;
  assignedDateUtc: string;
  assignments: ApiAssignGuideToServiceResponse[];
};

type ApiAvailableGuide = {
  guideId: number;
  guideName: string;
  busyShiftCodes?: string[] | null;
  availableShiftCodes?: string[] | null;
};

type ApiTimelineGuide = {
  id: number;
  name: string;
  tags: string[];
  busyDates: ApiBusyDate[];
  timeExceptions: ApiGuideTimeException[];
};

type ApiTimelineBooking = {
  id: string;
  series?: string | null;
  ref: string;
  startDay?: string | null;
  duration: number;
  client: string;
  groupName: string;
  tourName: string;
  status: string;
  country?: string | null;
  assignedGuides: string[];
  confirmedGuides: string[];
  guideStatuses?: Record<string, number>;
};

type ApiTimelineData = {
  bookingsData: ApiTimelineBooking[];
  bookingSeries: Array<{
    series: string;
    total: number;
    assigned: number;
    notAssigned: number;
    cancelled: number;
    onRequest: number;
    confirmed: number;
  }>;
  guidesData: ApiTimelineGuide[];
  itemAssignments: Record<string, number>;
  itemTimeSlots: Record<string, string>;
  emailRecords: Record<string, ApiGuideEmailRecord>;
  guideTimeExceptions: ApiGuideTimeException[];
};

type ApiBookingsGuideEmailRecord = {
  bookingId: string;
  guideId: number;
  status: "draft" | "sent";
  date?: string | null;
  subject: string;
  body: string;
};

type ApiBookingsGuideTimeException = {
  id: string;
  bookingId: string;
  guideId: number;
  date?: string | null;
  startHour: number;
  endHour: number;
};

type ApiBookingsBusyDate = {
  id: string;
  from?: string | null;
  to?: string | null;
};

type ApiBookingsGuide = {
  id: number;
  name: string;
  tags: string[];
  busyDates: ApiBookingsBusyDate[];
  timeExceptions: ApiBookingsGuideTimeException[];
};

type ApiBookingsBooking = {
  id: string;
  series?: string | null;
  ref: string;
  startDay?: string | null;
  duration: number;
  client: string;
  groupName: string;
  tourName: string;
  status: string;
  country?: string | null;
  assignedGuides: string[];
  confirmedGuides: string[];
  guideStatuses?: Record<string, number>;
};

type ApiBookingsData = {
  bookingsData: ApiBookingsBooking[];
  bookingSeries: Array<{
    series: string;
    total: number;
    assigned: number;
    notAssigned: number;
    cancelled: number;
    onRequest: number;
    confirmed: number;
  }>;
  guidesData: ApiBookingsGuide[];
  itemAssignments: Record<string, number>;
  itemTimeSlots: Record<string, string>;
  emailRecords: Record<string, ApiBookingsGuideEmailRecord>;
  guideTimeExceptions: ApiBookingsGuideTimeException[];
};

type ApiBookingManagerData = {
  days: Array<{
    dayNum: number;
    date?: string | null;
    items: Array<{
      id: string;
      type: string;
    }>;
  }>;
  itemAssignments: Record<string, number>;
  itemTimeSlots: Record<string, string>;
  guideStatuses?: Record<string, number>;
};

type TimelineQuery = {
  from?: string;
  to?: string;
  countryXid?: number;
  search?: string;
  client?: string;
  country?: string;
  guide?: string;
  series?: "all" | "series" | "noseries";
  loadSeries?: string;
  seriesSkip?: number;
  seriesTake?: number;
};

type BookingsQuery = Omit<TimelineQuery, "countryXid">;

const normalizeTag = (value: string) => value.trim().toUpperCase();
const normalizeSeriesName = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : "NO SERIES";
};

const mergeBookingSeries = (
  items: Array<{
    series: string;
    total: number;
    assigned: number;
    notAssigned: number;
    cancelled: number;
    onRequest: number;
    confirmed: number;
  }>,
): TimelineBookingSeries[] => {
  const merged = new Map<string, TimelineBookingSeries>();

  items.forEach((item) => {
    const series = normalizeSeriesName(item.series);
    const current = merged.get(series);
    if (current) {
      current.total += item.total;
      current.assigned += item.assigned;
      current.notAssigned += item.notAssigned;
      current.cancelled += item.cancelled;
      current.onRequest += item.onRequest;
      current.confirmed += item.confirmed;
      return;
    }

    merged.set(series, {
      series,
      total: item.total,
      assigned: item.assigned,
      notAssigned: item.notAssigned,
      cancelled: item.cancelled,
      onRequest: item.onRequest,
      confirmed: item.confirmed,
    });
  });

  return Array.from(merged.values());
};

const formatLongDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );

const getAge = (value: string) => {
  const birthDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  const dayDelta = today.getDate() - birthDate.getDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }
  return age;
};

const splitBiography = (value: string) => {
  const parts = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ["Guide profile synced from backend."];
};

const ensureGuideStatus = (value: string) => (value === "Inactive" ? "Inactive" : "Active");
const ensureWhtType = (value: string): WhtType => (value === "Non-resident" ? "Non-resident" : "Resident");
const ensureServiceDayPart = (value: string): ServiceDayPart => {
  if (value === "morning" || value === "afternoon" || value === "evening") return value;
  return "full-day";
};
const ensureShiftCode = (value: string | null | undefined): ShiftCode => {
  switch ((value ?? "").trim().toUpperCase()) {
    case "M1":
    case "M2":
    case "A1":
    case "A2":
    case "E1":
    case "E2":
    case "N1":
    case "N2":
    case "ALL":
      return (value ?? "").trim().toUpperCase() as ShiftCode;
    default:
      return "ALL";
  }
};

const parseAppearanceTags = (value: string) =>
  value
    .split(",")
    .map((part) => normalizeTag(part))
    .filter((tag, index, items) => tag.length > 0 && items.indexOf(tag) === index);

const buildApiUrl = (path: string) => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const getWhtTaxByType = (type: WhtType) => (type === "Resident" ? 10.21 : 20.42);
export const buildGuideEmailKey = (bookingId: string, guideId: number) => `${bookingId}-${guideId}`;
const mapGuideRank = (value: number) => {
  switch (value) {
    case 0:
      return "S";
    case 1:
      return "A";
    case 2:
      return "B";
    case 3:
      return "C";
    case 4:
      return "D";
    case 5:
      return "E";
    default:
      return "";
  }
};

const mapGuideProfile = (guide: ApiGuideDetail): GuideProfileData => ({
  id: guide.id,
  name: guide.name,
  email: guide.email ?? "",
  phone: guide.phone ?? "",
  dateOfBirth: guide.dateOfBirth ? `${formatLongDate(guide.dateOfBirth)} (${getAge(guide.dateOfBirth)} yrs)` : "N/A",
  address: guide.address ?? "",
  location: [guide.city, guide.country].filter(Boolean).join(", "),
  avatar: guide.avatar || DEFAULT_AVATAR,
  status: ensureGuideStatus(guide.status),
  fullTime: !guide.partTime,
  whtSummary: `${ensureWhtType(guide.whtType)} • ${Number(guide.whtTax ?? 0).toFixed(2)}%`,
  tags: guide.tags ?? [],
  languages: (guide.languages ?? []).map((language) => ({
    language: language.language,
    level: language.level,
  })),
  certifications: (guide.certifications ?? []).map((certification) => ({
    id: certification.id,
    name: certification.name,
    expiry: certification.expiry ?? undefined,
    org: certification.org ?? undefined,
  })),
  tourRecord: guide.tourRecord ?? "",
  notes: guide.notes ?? "",
  taxCode: guide.taxCode ?? "",
  bankName: guide.bankName ?? "",
  bankAccountNumber: guide.bankAccountNumber ?? "",
  bankAccountName: guide.bankAccountName ?? "",
  stats: {
    totalTours: guide.historicalTours ?? 0,
    avgRating: Number(guide.averageRating ?? 0),
    yearsExp: mapGuideRank(Number(guide.rating ?? 0)),
  },
  bio: guide.bio?.length ? guide.bio : ["Guide profile synced from backend."],
  upcomingTours: [],
});

const mapGuideFormData = (guide?: ApiGuideDetail | null): GuideFormData => ({
  id: guide?.id,
  name: guide?.name ?? "",
  email: guide?.email ?? "",
  phone: guide?.phone ?? "",
  dateOfBirth: guide?.dateOfBirth ?? "",
  address: guide?.address ?? "",
  city: guide?.city ?? "",
  country: guide?.country ?? "",
  partTime: guide?.partTime ?? false,
  licenseName: guide?.licenseName ?? "",
  startDateWithUs: guide?.startDateWithUs ?? "",
  tourRecord: guide?.tourRecord ?? "",
  notes: guide?.notes ?? "",
  taxCode: guide?.taxCode ?? "",
  bankName: guide?.bankName ?? "",
  bankAccountNumber: guide?.bankAccountNumber ?? "",
  bankAccountName: guide?.bankAccountName ?? "",
  whtType: ensureWhtType(guide?.whtType ?? "Resident"),
  whtTax: Number(guide?.whtTax ?? getWhtTaxByType("Resident")),
  status: ensureGuideStatus(guide?.status ?? "Active"),
  appearance: guide?.appearance ?? (guide?.tags ?? []).join(", "),
  languages:
    guide?.languages?.map((language) => ({
      language: language.language,
      proficiency: language.level,
    })) ?? [{ language: "English", proficiency: "Intermediate" }],
  biography: guide?.bio?.join("\n\n") ?? "",
});

const mapTimelineData = (data: ApiTimelineData): TimelineData => ({
  bookingsData: (data.bookingsData ?? []).map((booking) => ({
    id: booking.id,
    series: normalizeSeriesName(booking.series),
    ref: booking.ref,
    startDay: booking.startDay ?? "",
    duration: booking.duration,
    client: booking.client,
    groupName: booking.groupName,
    tourName: booking.tourName,
    status: booking.status,
    country: booking.country ?? undefined,
    assignedGuides: booking.assignedGuides ?? [],
    confirmedGuides: booking.confirmedGuides ?? [],
    guideStatuses: booking.guideStatuses ?? {},
  })),
  bookingSeries: mergeBookingSeries(data.bookingSeries ?? []),
  guidesData: (data.guidesData ?? []).map((guide) => ({
    id: guide.id,
    name: guide.name,
    tags: guide.tags ?? [],
    busyDates: (guide.busyDates ?? []).map((busyDate) => ({
      id: busyDate.id,
      from: busyDate.from ?? "",
      to: busyDate.to ?? "",
    })),
    timeExceptions: (guide.timeExceptions ?? []).map((exception) => ({
      id: exception.id,
      bookingId: exception.bookingId,
      guideId: exception.guideId,
      date: exception.date ?? "",
      startHour: exception.startHour,
      endHour: exception.endHour,
    })),
  })),
  itemAssignments: data.itemAssignments ?? {},
  itemTimeSlots: Object.fromEntries(
    Object.entries(data.itemTimeSlots ?? {}).map(([itemId, slot]) => [itemId, ensureServiceDayPart(slot)]),
  ),
  emailRecords: Object.fromEntries(
    Object.entries(data.emailRecords ?? {}).map(([key, record]) => [
      key,
      {
        status: record.status === "sent" ? "sent" : "draft",
        date: record.date ?? "",
        subject: record.subject ?? "",
        body: record.body ?? "",
      },
    ]),
  ),
  guideTimeExceptions: (data.guideTimeExceptions ?? []).map((exception) => ({
    id: exception.id,
    bookingId: exception.bookingId,
    guideId: exception.guideId,
    date: exception.date ?? "",
    startHour: exception.startHour,
    endHour: exception.endHour,
  })),
});

const mapBookingsData = (data: ApiBookingsData): TimelineData => ({
  bookingsData: (data.bookingsData ?? []).map((booking) => ({
    id: booking.id,
    series: normalizeSeriesName(booking.series),
    ref: booking.ref,
    startDay: booking.startDay ?? "",
    duration: booking.duration,
    client: booking.client,
    groupName: booking.groupName,
    tourName: booking.tourName,
    status: booking.status,
    country: booking.country ?? undefined,
    assignedGuides: booking.assignedGuides ?? [],
    confirmedGuides: booking.confirmedGuides ?? [],
    guideStatuses: booking.guideStatuses ?? {},
  })),
  bookingSeries: mergeBookingSeries(data.bookingSeries ?? []),
  guidesData: (data.guidesData ?? []).map((guide) => ({
    id: guide.id,
    name: guide.name,
    tags: guide.tags ?? [],
    busyDates: (guide.busyDates ?? []).map((busyDate) => ({
      id: busyDate.id,
      from: busyDate.from ?? "",
      to: busyDate.to ?? "",
    })),
    timeExceptions: (guide.timeExceptions ?? []).map((exception) => ({
      id: exception.id,
      bookingId: exception.bookingId,
      guideId: exception.guideId,
      date: exception.date ?? "",
      startHour: exception.startHour,
      endHour: exception.endHour,
    })),
  })),
  itemAssignments: data.itemAssignments ?? {},
  itemTimeSlots: Object.fromEntries(
    Object.entries(data.itemTimeSlots ?? {}).map(([itemId, slot]) => [itemId, ensureServiceDayPart(slot)]),
  ),
  emailRecords: Object.fromEntries(
    Object.entries(data.emailRecords ?? {}).map(([key, record]) => [
      key,
      {
        status: record.status === "sent" ? "sent" : "draft",
        date: record.date ?? "",
        subject: record.subject ?? "",
        body: record.body ?? "",
      },
    ]),
  ),
  guideTimeExceptions: (data.guideTimeExceptions ?? []).map((exception) => ({
    id: exception.id,
    bookingId: exception.bookingId,
    guideId: exception.guideId,
    date: exception.date ?? "",
    startHour: exception.startHour,
    endHour: exception.endHour,
  })),
});

const mapBookingManagerData = (data: ApiBookingManagerData): BookingManagerData => ({
  days: (data.days ?? []).map((day) => ({
    dayNum: day.dayNum,
    dateStr: day.date ?? "",
    items: (day.items ?? []).map((item) => ({
      id: item.id,
      type: item.type,
    })),
  })),
  itemAssignments: data.itemAssignments ?? {},
  itemTimeSlots: Object.fromEntries(
    Object.entries(data.itemTimeSlots ?? {}).map(([itemId, slot]) => [itemId, ensureServiceDayPart(slot)]),
  ),
  guideStatuses: data.guideStatuses ?? {},
});

const mapAssignGuideToServiceResponse = (
  assignment: ApiAssignGuideToServiceResponse,
): AssignGuideToServiceResponse => ({
  pid: assignment.pid,
  resHolidayXid: assignment.resHolidayXid,
  supplierGuideXid: assignment.supplierGuideXid,
  arrDate: assignment.arrDate,
  maCa: assignment.maCa,
  busyStatus: assignment.busyStatus,
  assignStatus: assignment.assignStatus,
  assignedBy: assignment.assignedBy,
  assignedDateUtc: assignment.assignedDateUtc,
  operatorNote: assignment.operatorNote ?? "",
});

const mapAssignGuideToServicesResponse = (
  assignment: ApiAssignGuideToServicesResponse,
): AssignGuideToServicesResponse => ({
  supplierGuideXid: assignment.supplierGuideXid,
  maCa: assignment.maCa,
  assignedBy: assignment.assignedBy,
  assignedDateUtc: assignment.assignedDateUtc,
  assignments: (assignment.assignments ?? []).map(mapAssignGuideToServiceResponse),
});

export const mockApi = {
  async getGuides(): Promise<GuideDirectoryItem[]> {
    return request<ApiGuideDirectoryItem[]>("/api/guides");
  },

  async getGuideName(guideId: number): Promise<string | null> {
    const guide = await request<ApiGuideDetail>(`/api/guides/${guideId}`);
    return guide?.name ?? null;
  },

  async getGuideProfile(guideId: number): Promise<GuideProfileData | null> {
    try {
      const guide = await request<ApiGuideDetail>(`/api/guides/${guideId}`);
      return mapGuideProfile(guide);
    } catch {
      return null;
    }
  },

  async getGuideFormData(guideId?: number): Promise<GuideFormData> {
    if (typeof guideId !== "number") {
      return mapGuideFormData(null);
    }

    try {
      const guide = await request<ApiGuideDetail>(`/api/guides/${guideId}`);
      return mapGuideFormData(guide);
    } catch {
      return mapGuideFormData(null);
    }
  },

  async getGuideClientTags(): Promise<string[]> {
    const tags = await request<string[]>("/api/guides/meta/tags");
    return tags.map(normalizeTag).sort();
  },

  async createGuideClientTag(tag: string): Promise<string[]> {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) {
      return this.getGuideClientTags();
    }

    const tags = await request<string[]>("/api/guides/meta/tags", {
      method: "POST",
      body: JSON.stringify({ tag: normalizedTag }),
    });
    return tags.map(normalizeTag).sort();
  },

  async getCityOptions(): Promise<CityOption[]> {
    return request<CityOption[]>("/api/guides/meta/cities");
  },

  async getCountryOptions(): Promise<CountryOption[]> {
    return request<ApiCountryOption[]>("/api/guides/meta/countries");
  },

  async saveGuide(formData: GuideFormData): Promise<number> {
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      dateOfBirth: formData.dateOfBirth || null,
      address: formData.address.trim(),
      city: formData.city.trim(),
      country: formData.country.trim(),
      avatar: DEFAULT_AVATAR,
      status: formData.status,
      partTime: formData.partTime,
      rating: 0,
      whtType: formData.whtType,
      whtTax: Number(formData.whtTax),
      tourRecord: formData.tourRecord.trim(),
      notes: formData.notes.trim(),
      taxCode: formData.taxCode.trim(),
      bankName: formData.bankName.trim(),
      bankAccountNumber: formData.bankAccountNumber.trim(),
      bankAccountName: formData.bankAccountName.trim(),
      licenseName: formData.licenseName.trim(),
      startDateWithUs: formData.startDateWithUs || null,
      historicalTours: 0,
      averageRating: 0,
      yearsExperience: 0,
      appearance: formData.appearance.trim(),
      tags: parseAppearanceTags(formData.appearance),
      languages: formData.languages
        .filter((language) => language.language && language.proficiency)
        .map((language) => ({
          language: language.language,
          level: language.proficiency,
        })),
      certifications: [],
      bio: splitBiography(formData.biography),
    };

    if (typeof formData.id === "number") {
      await request<void>(`/api/guides/${formData.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return formData.id;
    }

    const result = await request<{ id: number }>("/api/guides", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return result.id;
  },

  async getTimelineData(query?: TimelineQuery): Promise<TimelineData> {
    const searchParams = new URLSearchParams();
    if (query?.from) searchParams.set("from", query.from);
    if (query?.to) searchParams.set("to", query.to);
    if (typeof query?.countryXid === "number") searchParams.set("countryXid", String(query.countryXid));
    if (query?.search) searchParams.set("search", query.search);
    if (query?.client) searchParams.set("client", query.client);
    if (query?.country) searchParams.set("country", query.country);
    if (query?.guide) searchParams.set("guide", query.guide);
    if (query?.series && query.series !== "all") searchParams.set("series", query.series);
    if (query?.loadSeries) searchParams.set("loadSeries", query.loadSeries);
    if (typeof query?.seriesSkip === "number") searchParams.set("seriesSkip", String(query.seriesSkip));
    if (typeof query?.seriesTake === "number") searchParams.set("seriesTake", String(query.seriesTake));
    const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
    const timeline = await request<ApiTimelineData>(`/api/timeline${suffix}`);
    return mapTimelineData(timeline);
  },

  async getBookingsData(query?: BookingsQuery): Promise<TimelineData> {
    const searchParams = new URLSearchParams();
    if (query?.from) searchParams.set("from", query.from);
    if (query?.to) searchParams.set("to", query.to);
    if (query?.search) searchParams.set("search", query.search);
    if (query?.client) searchParams.set("client", query.client);
    if (query?.country) searchParams.set("country", query.country);
    if (query?.guide) searchParams.set("guide", query.guide);
    if (query?.series && query.series !== "all") searchParams.set("series", query.series);
    if (query?.loadSeries) searchParams.set("loadSeries", query.loadSeries);
    if (typeof query?.seriesSkip === "number") searchParams.set("seriesSkip", String(query.seriesSkip));
    if (typeof query?.seriesTake === "number") searchParams.set("seriesTake", String(query.seriesTake));
    const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
    const bookings = await request<ApiBookingsData>(`/api/bookings${suffix}`);
    return mapBookingsData(bookings);
  },

  async getBookingManagerData(bookingRef: string): Promise<BookingManagerData> {
    const data = await request<ApiBookingManagerData>(`/api/bookings/${encodeURIComponent(bookingRef)}/manager`);
    return mapBookingManagerData(data);
  },

  async assignGuideToService(payload: AssignGuideToServiceRequest): Promise<AssignGuideToServiceResponse> {
    const assignment = await request<ApiAssignGuideToServiceResponse>("/api/service-guide-assignments", {
      method: "POST",
      body: JSON.stringify({
        resHolidayXid: payload.resHolidayXid,
        supplierGuideXid: payload.supplierGuideXid,
        arrDate: payload.arrDate ?? null,
        maCa: payload.maCa ?? "ALL",
        operatorNote: payload.operatorNote ?? "",
        assignedBy: payload.assignedBy,
      }),
    });

    return mapAssignGuideToServiceResponse(assignment);
  },

  async assignGuideToServices(payload: AssignGuideToServicesRequest): Promise<AssignGuideToServicesResponse> {
    const assignment = await request<ApiAssignGuideToServicesResponse>("/api/service-guide-assignments/batch", {
      method: "POST",
      body: JSON.stringify({
        supplierGuideXid: payload.supplierGuideXid,
        items: payload.items.map((item) => ({
          resHolidayXid: item.resHolidayXid,
          arrDate: item.arrDate,
        })),
        maCa: payload.maCa ?? "ALL",
        operatorNote: payload.operatorNote ?? "",
        assignedBy: payload.assignedBy,
      }),
    });

    return mapAssignGuideToServicesResponse(assignment);
  },

  async searchAvailableGuides(arrDate: string, maCa: ShiftCode): Promise<AvailableGuide[]> {
    const searchParams = new URLSearchParams({
      arrDate,
      maCa,
    });

    const guides = await request<ApiAvailableGuide[]>(`/api/service-guide-assignments/available-guides?${searchParams.toString()}`);
    return (guides ?? []).map((guide) => ({
      guideId: guide.guideId,
      guideName: guide.guideName,
      busyShiftCodes: (guide.busyShiftCodes ?? []).map((shiftCode) => ensureShiftCode(shiftCode)),
      availableShiftCodes: (guide.availableShiftCodes ?? []).map((shiftCode) => ensureShiftCode(shiftCode)),
    }));
  },

  async searchAvailableGuidesForDates(arrDates: string[], maCa: ShiftCode): Promise<AvailableGuide[]> {
    const guides = await request<ApiAvailableGuide[]>("/api/service-guide-assignments/available-guides/search", {
      method: "POST",
      body: JSON.stringify({
        arrDates,
        maCa,
      }),
    });

    return (guides ?? []).map((guide) => ({
      guideId: guide.guideId,
      guideName: guide.guideName,
      busyShiftCodes: (guide.busyShiftCodes ?? []).map((shiftCode) => ensureShiftCode(shiftCode)),
      availableShiftCodes: (guide.availableShiftCodes ?? []).map((shiftCode) => ensureShiftCode(shiftCode)),
    }));
  },

  async confirmServiceGuide(resHolidayId: number): Promise<void> {
    await request<void>("/api/service-guide-assignments/confirm", {
      method: "POST",
      body: JSON.stringify({ resHolidayId }),
    });
  },

  async unassignGuideFromService(resHolidayId: number, guideId: number): Promise<void> {
    await request<void>(`/api/service-guide-assignments/${resHolidayId}/guides/${guideId}`, {
      method: "DELETE",
    });
  },

  async markGuidePersonalBusy(guideId: number, dateNghi: string, caNghi: ShiftCode): Promise<void> {
    await request<void>("/api/service-guide-assignments/busy-personal", {
      method: "POST",
      body: JSON.stringify({
        guideId,
        dateNghi,
        caNghi,
      }),
    });
  },

  async setBookingGuideConfirmation(bookingId: string, guideName: string, confirmed: boolean): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/booking-guide-confirmation", {
      method: "POST",
      body: JSON.stringify({ bookingId, guideName, confirmed }),
    });
    return mapTimelineData(timeline);
  },

  async addGuideBusyDate(guideId: number, from: string, to: string): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/guide-busy-dates", {
      method: "POST",
      body: JSON.stringify({ guideId, from, to }),
    });
    return mapTimelineData(timeline);
  },

  async removeGuideBusyDate(guideId: number, busyDateId: string): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>(`/api/timeline/guide-busy-dates/${guideId}/${busyDateId}`, {
      method: "DELETE",
    });
    return mapTimelineData(timeline);
  },

  async setBookingItemTimeSlot(itemId: string, slot: ServiceDayPart): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/booking-item-time-slot", {
      method: "POST",
      body: JSON.stringify({ itemId, slot }),
    });
    return mapTimelineData(timeline);
  },

  async assignBookingItems(guideId: number, resHolidayIds: number[]): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/assign-booking-items", {
      method: "POST",
      body: JSON.stringify({ guideId, resHolidayIds }),
    });
    return mapTimelineData(timeline);
  },

  async unassignBookingItems(resHolidayIds: number[]): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/unassign-booking-items", {
      method: "POST",
      body: JSON.stringify({ resHolidayIds }),
    });
    return mapTimelineData(timeline);
  },

  async unassignGuideFromBooking(bookingId: string, guideName: string): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>(
      `/api/timeline/bookings/${encodeURIComponent(bookingId)}/guides/${encodeURIComponent(guideName)}`,
      {
        method: "DELETE",
      },
    );
    return mapTimelineData(timeline);
  },

  async setGuideEmailRecord(bookingId: string, guideId: number, payload: GuideEmailRecord): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/guide-email-record", {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        guideId,
        status: payload.status,
        date: payload.date || null,
        subject: payload.subject,
        body: payload.body,
      }),
    });
    return mapTimelineData(timeline);
  },

  async getGuideBookingShifts(bookingId: string, guideId: number): Promise<GuideBookingShift[]> {
    const shifts = await request<ApiGuideBookingShift[]>(
      `/api/timeline/guide-booking-shifts/${encodeURIComponent(bookingId)}/${guideId}`,
    );

    return (shifts ?? [])
      .filter((entry) => Boolean(entry.date))
      .map((entry) => ({
        date: entry.date ?? "",
        shift: ensureShiftCode(entry.shift),
      }));
  },

  async setGuideBookingShifts(
    bookingId: string,
    guideId: number,
    entries: GuideBookingShift[],
  ): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/guide-booking-shifts", {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        guideId,
        entries: entries.map((entry) => ({
          date: entry.date,
          shift: ensureShiftCode(entry.shift),
        })),
      }),
    });
    return mapTimelineData(timeline);
  },

  async setGuideBookingTimeExceptions(
    bookingId: string,
    guideId: number,
    entries: Array<{ date: string; startHour: number; endHour: number }>,
  ): Promise<TimelineData> {
    const timeline = await request<ApiTimelineData>("/api/timeline/guide-time-exceptions", {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        guideId,
        entries: entries.map((entry) => ({
          date: entry.date,
          startHour: entry.startHour,
          endHour: entry.endHour,
        })),
      }),
    });
    return mapTimelineData(timeline);
  },
};
