export type GuideStatus = "Active" | "Inactive";

export type WhtType = "Resident" | "Non-resident";

export type BusyDate = {
  id: string;
  from: string;
  to: string;
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
  location: string;
  avatar: string;
  status: GuideStatus;
  fullTime: boolean;
  whtSummary: string;
  tags: string[];
  languages: GuideLanguage[];
  certifications: GuideCertification[];
  tourRecord: string;
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
  city: string;
  licenseName: string;
  startDateWithUs: string;
  tourRecord: string;
  whtType: WhtType;
  whtTax: number;
  status: GuideStatus;
  tags: string[];
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
