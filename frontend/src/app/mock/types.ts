export type GuideStatus = "Active" | "Inactive";

export type WhtType = "Resident" | "Non-resident";

export type BusyDate = {
  id: string;
  from: string;
  to: string;
  busy?: string;
  comment?: string;
};

export type GuideLanguage = {
  language: string;
  level: string;
};

export type GuideFormLanguage = {
  language: string;
  proficiency: string;
};

export type GuideCertification = {
  id: string;
  name: string;
  expiry?: string;
  org?: string;
};

export type CityOption = {
  city: string;
  country: string;
};

export type CountryOption = {
  xid: number;
  name: string;
};

export type ServiceDayPart = "full-day" | "morning" | "afternoon" | "evening";

export type ShiftCode = "M1" | "M2" | "A1" | "A2" | "E1" | "E2" | "N1" | "N2" | "ALL";

export type GuideEmailStatus = "draft" | "sent";

export type GuideEmailRecord = {
  status: GuideEmailStatus;
  date: string;
  subject: string;
  body: string;
};

export type GuideTimeException = {
  id: string;
  bookingId: string;
  guideId: number;
  date: string;
  startHour: number;
  endHour: number;
};

export type GuideBookingShift = {
  date: string;
  shift: ShiftCode;
};

export type GuideRecord = {
  id: number;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  city: string;
  country: string;
  avatar: string;
  status: GuideStatus;
  partTime: boolean;
  rating: number;
  whtType: WhtType;
  whtTax: number;
  tags: string[];
  languages: GuideLanguage[];
  certifications: GuideCertification[];
  tourRecord: string;
  bio: string[];
  startDateWithUs: string;
  licenseName: string;
  historicalTours: number;
  averageRating: number;
  yearsExperience: number;
  busyDates: BusyDate[];
};

export type BookingRecord = {
  id: string;
  ref: string;
  startDay: string;
  duration: number;
  client: string;
  groupName: string;
  tourName: string;
  status: string;
  country?: string;
  assignedGuideIds: number[];
  confirmedGuideIds: number[];
};

export type MockDatabaseState = {
  guides: GuideRecord[];
  bookings: BookingRecord[];
  itemAssignments: Record<string, number>;
  itemTimeSlots: Record<string, ServiceDayPart>;
  emailRecords: Record<string, GuideEmailRecord>;
  guideTimeExceptions: GuideTimeException[];
  cityOptions: CityOption[];
  guideClientTags: string[];
};

export type GuideDirectoryItem = {
  id: number;
  name: string;
  tags: string[];
  status: GuideStatus;
  partTime: boolean;
  rating: number;
};

export type GuideProfileStats = {
  totalTours: number;
  avgRating: number;
  yearsExp: string;
};

export type GuideUpcomingTour = {
  id: string;
  date: string;
  name: string;
  client: string;
  status: string;
};

export type GuideProfileData = {
  id: number;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  location: string;
  avatar: string;
  status: GuideStatus;
  fullTime: boolean;
  whtSummary: string;
  tags: string[];
  languages: GuideLanguage[];
  certifications: GuideCertification[];
  tourRecord: string;
  notes: string;
  taxCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  stats: GuideProfileStats;
  bio: string[];
  upcomingTours: GuideUpcomingTour[];
};

export type GuideFormData = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  partTime: boolean;
  licenseName: string;
  startDateWithUs: string;
  tourRecord: string;
  notes: string;
  taxCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  whtType: WhtType;
  whtTax: number;
  status: GuideStatus;
  appearance: string;
  languages: GuideFormLanguage[];
  biography: string;
};

export type TimelineBooking = {
  id: string;
  series: string;
  ref: string;
  startDay: string;
  duration: number;
  client: string;
  groupName: string;
  tourName: string;
  status: string;
  assignedGuides: string[];
  confirmedGuides: string[];
  guideStatuses: Record<string, number>;
  country?: string;
};

export type TimelineGuide = {
  id: number;
  name: string;
  tags: string[];
  busyDates: BusyDate[];
  timeExceptions: GuideTimeException[];
};

export type TimelineBookingSeries = {
  series: string;
  total: number;
  assigned: number;
  notAssigned: number;
  cancelled: number;
  onRequest: number;
  confirmed: number;
};

export type BookingManagerItem = {
  id: string;
  type: string;
};

export type BookingManagerDay = {
  dayNum: number;
  dateStr: string;
  items: BookingManagerItem[];
};

export type BookingManagerData = {
  days: BookingManagerDay[];
  itemAssignments: Record<string, number>;
  itemTimeSlots: Record<string, ServiceDayPart>;
  guideStatuses: Record<string, number>;
};

export type AvailableGuide = {
  guideId: number;
  guideName: string;
  busyShiftCodes: ShiftCode[];
  availableShiftCodes: ShiftCode[];
};

export type AssignGuideToServiceRequest = {
  resHolidayXid: number;
  supplierGuideXid: number;
  arrDate?: string;
  maCa?: ShiftCode;
  operatorNote?: string;
  assignedBy: number;
};

export type AssignGuideToServicesRequest = {
  supplierGuideXid: number;
  items: Array<{
    resHolidayXid: number;
    arrDate: string;
  }>;
  maCa?: ShiftCode;
  operatorNote?: string;
  assignedBy: number;
};

export type AssignGuideToServiceResponse = {
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

export type AssignGuideToServicesResponse = {
  supplierGuideXid: number;
  maCa: ShiftCode;
  assignedBy: number;
  assignedDateUtc: string;
  assignments: AssignGuideToServiceResponse[];
};

export type TimelineData = {
  bookingsData: TimelineBooking[];
  bookingSeries: TimelineBookingSeries[];
  guidesData: TimelineGuide[];
  itemAssignments: Record<string, number>;
  itemTimeSlots: Record<string, ServiceDayPart>;
  emailRecords: Record<string, GuideEmailRecord>;
  guideTimeExceptions: GuideTimeException[];
};
