import { useState, useMemo, useEffect, useRef, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  LayoutDashboard,
  Users,
  Calendar,
  Plus,
  X,
  AlertCircle,
  ChevronDown,
  Filter,
  ZoomIn,
  UserCheck,
  Briefcase,
  History,
  PlaneLanding,
  Pencil,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import { buildGuideEmailKey, mockApi } from "../mock/api";
import { TimelineBookingAssignmentModal } from "../components/timeline/TimelineBookingAssignmentModal";
import { TimelineBookingsTab } from "../components/timeline/TimelineBookingsTab";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import type {
  BookingManagerDay,
  AvailableGuide,
  CountryOption,
  GuideEmailRecord,
  GuideTimeException,
  ServiceDayPart,
  ShiftCode,
  TimelineBookingSeries,
} from "../mock/types";

type Booking = {
  id: string;
  series: string;
  ref: string;
  startDay: string;
  duration: number;
  client: string;
  groupName: string;
  tourName?: string;
  status: string;
  assignedGuides: string[];
  confirmedGuides: string[];
  guideStatuses: Record<string, number>;
  country?: string;
  managerDays?: BookingManagerDay[];
};

type BusyDate = {
  id: string;
  from: string;
  to: string;
};

type Guide = {
  id: number;
  name: string;
  tags: string[];
  busyDates: BusyDate[];
  timeExceptions: GuideTimeException[];
};

type GuideTimeRangeDraft = {
  date: string;
  shift: ShiftCode;
};

type GuideTimingModalState = {
  guideId: number;
  guideName: string;
  bookingId: string;
  title: string;
  submitLabel: string;
  description: string;
  drafts: GuideTimeRangeDraft[];
} | null;

type GuideAvailability = {
  label: string;
  color: string;
  selectable: boolean;
  requiresTimeInput?: boolean;
  requiresShiftSelection: boolean;
  availableShiftCodes: ShiftCode[];
  busyShiftCodes: ShiftCode[];
};

type PendingGuideStatusChange = {
  bookingId: string;
  bookingRef: string;
  guideName: string;
  isConfirmed: boolean;
} | null;

type EmailComposerState = {
  bookingId: string;
  bookingRef: string;
  guideId: number;
  guideName: string;
  date: string;
  subject: string;
  body: string;
  actionLabel?: "draft" | "sent";
} | null;

// --- Helper Functions ---

const checkOverlap = (start1: number, end1: number, start2: number, end2: number) => {
  return start1 <= end2 && end1 >= start2;
};

const BOOKING_SERIES_PAGE_SIZE = 10;

const formatHour = (value: number) => `${value.toString().padStart(2, "0")}:00`;

const formatHourRange = (startHour: number, endHour: number) => `${formatHour(startHour)} - ${formatHour(endHour)}`;

const toDateKey = (value: Date) => value.toISOString().split("T")[0];

const getBookingSeriesName = (booking: { series?: string | null }) => booking.series?.trim() || "NO SERIES";

const getGuideAssignStatus = (booking: { guideStatuses?: Record<string, number> }, guideName: string) =>
  booking.guideStatuses?.[guideName] ?? 1;

const isGuideConfirmed = (booking: { guideStatuses?: Record<string, number> }, guideName: string) =>
  getGuideAssignStatus(booking, guideName) === 2;

const getDynamicallyCalculatedStatus = (guide: any, targetIntervals: { start: number, end: number }[], itemAssignments: Record<string, number>) => {
  for (const b of guide.busyDates) {
    const bStartMs = new Date(`${b.from}T00:00:00`).getTime();
    const bEndMs = new Date(`${b.to}T00:00:00`).getTime();
    if (targetIntervals.some(ti => checkOverlap(ti.start, ti.end, bStartMs, bEndMs))) {
      return { label: "Busy", color: "text-red-600" };
    }
  }

  for (const t of guide.tours) {
    if (t.status?.toLowerCase() === "cancelled") continue;

    let hasAnyAssignmentForBooking = false;
    let hasDetailedAssignmentsForThisGuide = false;
    let assignedDays = new Set<number>();

    Object.entries(itemAssignments).forEach(([itemId, gId]) => {
      if (itemId.startsWith(`${t.id}-`)) {
        hasAnyAssignmentForBooking = true;
        if (gId === guide.id) {
          hasDetailedAssignmentsForThisGuide = true;
          const match = itemId.match(/-d(\d+)-/);
          if (match) assignedDays.add(parseInt(match[1], 10));
        }
      }
    });

    if (hasAnyAssignmentForBooking) {
      if (hasDetailedAssignmentsForThisGuide && assignedDays.size > 0) {
        for (const day of assignedDays) {
          const dS = new Date(`${t.startDay}T00:00:00`);
          dS.setDate(dS.getDate() + (day - 1));
          const dayMs = dS.getTime();
          if (targetIntervals.some(ti => checkOverlap(ti.start, ti.end, dayMs, dayMs))) {
            return { label: "On Tour", color: "text-[#1D3663]" };
          }
        }
      }
    } else {
      const tourStartMs = new Date(`${t.startDay}T00:00:00`).getTime();
      const tourEndMs = tourStartMs + (t.duration - 1) * 86400000;
      if (targetIntervals.some(ti => checkOverlap(ti.start, ti.end, tourStartMs, tourEndMs))) {
        return { label: "On Tour", color: "text-[#1D3663]" };
      }
    }
  }
  return { label: "Available", color: "text-[#1D3663]" };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GUIDES_PER_PAGE = 20;
const DEFAULT_COUNTRY_NAME = "Japan";
const SHIFT_OPTIONS: Array<{ value: ShiftCode; label: string }> = [
  { value: "ALL", label: "All day" },
  { value: "M1", label: "Morning 1" },
  { value: "M2", label: "Morning 2" },
  { value: "A1", label: "Afternoon 1" },
  { value: "A2", label: "Afternoon 2" },
  { value: "E1", label: "Evening 1" },
  { value: "E2", label: "Evening 2" },
  { value: "N1", label: "Night 1" },
  { value: "N2", label: "Night 2" },
];
const CONCRETE_SHIFT_OPTIONS = SHIFT_OPTIONS.filter((option) => option.value !== "ALL");

const formatDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    from: formatDateInputValue(start),
    to: formatDateInputValue(end),
  };
};

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
};

export function Timeline() {
  const defaultMonthRange = getCurrentMonthRange();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const queryTab = searchParams.get("tab");
  const queryGuideId = Number(searchParams.get("guideId"));
  const queryYear = Number(searchParams.get("year"));

  const [activeTab, setActiveTab] = useState<'calendar' | 'bookings'>(
    queryTab === "bookings" ? "bookings" : "calendar"
  );

  useEffect(() => {
    if (queryTab === "bookings") setActiveTab("bookings");
    else if (queryTab === "calendar") setActiveTab("calendar");
  }, [queryTab]);

  useEffect(() => {
    if (!Number.isNaN(queryYear) && queryYear > 0) {
      setCurrentYear(queryYear);
    }
  }, [queryYear]);

  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 3>(3);
  const [currentYear, setCurrentYear] = useState(2026);
  const [guidePage, setGuidePage] = useState(1);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const lastTimelineScrollLeftRef = useRef<number | null>(null);

  const [visibleDateStart, setVisibleDateStart] = useState("");
  const [visibleDateEnd, setVisibleDateEnd] = useState("");

  const [filterGuide, setFilterGuide] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [selectedCountryXid, setSelectedCountryXid] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState(defaultMonthRange.from);
  const [filterDateTo, setFilterDateTo] = useState(defaultMonthRange.to);
  const [draftFilterDateFrom, setDraftFilterDateFrom] = useState(defaultMonthRange.from);
  const [draftFilterDateTo, setDraftFilterDateTo] = useState(defaultMonthRange.to);
  const [filterSeries, setFilterSeries] = useState<"all" | "series" | "noseries">("all");
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);

  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalFilterCountry, setModalFilterCountry] = useState(DEFAULT_COUNTRY_NAME);
  const [modalFilterClient, setModalFilterClient] = useState("");
  const [modalFilterGuide, setModalFilterGuide] = useState("");
  const [modalFilterDateFrom, setModalFilterDateFrom] = useState(defaultMonthRange.from);
  const [modalFilterDateTo, setModalFilterDateTo] = useState(defaultMonthRange.to);
  const [modalFilterSeries, setModalFilterSeries] = useState<"all" | "series" | "noseries">("all");

  const debouncedModalSearchTerm = useDebouncedValue(modalSearchTerm, 300);
  const debouncedModalFilterClient = useDebouncedValue(modalFilterClient, 300);
  const debouncedModalFilterCountry = useDebouncedValue(modalFilterCountry, 300);
  const debouncedModalFilterGuide = useDebouncedValue(modalFilterGuide, 300);

  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  const [bookingsData, setBookingsData] = useState<Booking[]>([]);
  const [bookingSeries, setBookingSeries] = useState<TimelineBookingSeries[]>([]);
  const [guidesData, setGuidesData] = useState<Guide[]>([]);
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({});
  const [itemTimeSlots, setItemTimeSlots] = useState<Record<string, ServiceDayPart>>({});
  const [emailRecords, setEmailRecords] = useState<Record<string, GuideEmailRecord>>({});
  const [guideTimingModalState, setGuideTimingModalState] = useState<GuideTimingModalState>(null);
  const timelineRequestRef = useRef(0);
  const bookingManagerRequestRef = useRef(0);
  const pendingSeriesLoadRef = useRef(new Set<string>());
  const [isBookingsTableLoading, setIsBookingsTableLoading] = useState(false);
  const [loadingBookingSeries, setLoadingBookingSeries] = useState<string[]>([]);
  const [loadingManageBookingId, setLoadingManageBookingId] = useState<string | null>(null);
  const [timelineLoadingCount, setTimelineLoadingCount] = useState(0);
  const [timelineLoadingLabel, setTimelineLoadingLabel] = useState("Loading...");

  const runTimelineApi = async <T,>(label: string, action: () => Promise<T>, showOverlay = true) => {
    if (showOverlay) {
      setTimelineLoadingLabel(label);
      setTimelineLoadingCount((current) => current + 1);
    }
    try {
      return await action();
    } finally {
      if (showOverlay) {
        setTimelineLoadingCount((current) => Math.max(0, current - 1));
      }
    }
  };

  const applyTimelineSupportData = (data: {
    bookingsData: Booking[];
    bookingSeries: TimelineBookingSeries[];
    guidesData: Guide[];
    itemAssignments: Record<string, number>;
    itemTimeSlots: Record<string, ServiceDayPart>;
    emailRecords: Record<string, GuideEmailRecord>;
    guideTimeExceptions: GuideTimeException[];
  }) => {
    setBookingSeries(data.bookingSeries);
    setGuidesData(data.guidesData);
    setItemAssignments(data.itemAssignments);
    setItemTimeSlots(data.itemTimeSlots);
    setEmailRecords(data.emailRecords);
  };

  const applyTimelineData = (data: {
    bookingsData: Booking[];
    bookingSeries: TimelineBookingSeries[];
    guidesData: Guide[];
    itemAssignments: Record<string, number>;
    itemTimeSlots: Record<string, ServiceDayPart>;
    emailRecords: Record<string, GuideEmailRecord>;
    guideTimeExceptions: GuideTimeException[];
  }) => {
    setBookingsData(data.bookingsData);
    applyTimelineSupportData(data);
  };

  const mergeBookingManagerSupportData = (data: {
    itemAssignments: Record<string, number>;
    itemTimeSlots: Record<string, ServiceDayPart>;
  }) => {
    setItemAssignments((current) => ({ ...current, ...data.itemAssignments }));
    setItemTimeSlots((current) => ({ ...current, ...data.itemTimeSlots }));
  };

  const buildBookingManagerView = (booking: Booking, bookingManagerData: BookingManagerData): Booking => {
    const guideNameById = new Map(guidesData.map((guide) => [guide.id, guide.name]));
    const assignedGuides = Array.from(
      new Set(
        Object.values(bookingManagerData.itemAssignments)
          .map((guideId) => guideNameById.get(guideId))
          .filter((guideName): guideName is string => Boolean(guideName)),
      ),
    ).sort((left, right) => left.localeCompare(right));

    const guideStatuses = Object.fromEntries(
      Object.entries(bookingManagerData.guideStatuses ?? {})
        .map(([guideId, status]) => {
          const guideName = guideNameById.get(Number(guideId));
          return guideName ? [guideName, status] : null;
        })
        .filter((entry): entry is [string, number] => entry !== null),
    );

    return {
      ...booking,
      assignedGuides,
      confirmedGuides: assignedGuides.filter((guideName) => guideStatuses[guideName] === 2),
      guideStatuses,
      managerDays: bookingManagerData.days,
    };
  };

  const refreshActiveBookingManager = async (booking: Booking) => {
    const bookingManagerData = await runTimelineApi("Loading booking services...", () =>
      mockApi.getBookingManagerData(booking.ref),
    false,
    );

    mergeBookingManagerSupportData(bookingManagerData);
    const updatedBooking = buildBookingManagerView(booking, bookingManagerData);
    setBookingsData((current) =>
      current.map((item) => (item.id === updatedBooking.id ? { ...item, ...updatedBooking } : item)),
    );
    return updatedBooking;
  };

  const [pendingGuideStatusChange, setPendingGuideStatusChange] = useState<PendingGuideStatusChange>(null);
  const [emailComposerState, setEmailComposerState] = useState<EmailComposerState>(null);

  const clearTimelineData = () => {
    applyTimelineData({
      bookingsData: [],
      bookingSeries: [],
      guidesData: [],
      itemAssignments: {},
      itemTimeSlots: {},
      emailRecords: {},
      guideTimeExceptions: [],
    });
  };

  const resolveActiveAssignmentBooking = (
    data: {
      bookingsData: Booking[];
      guidesData: Guide[];
      itemAssignments: Record<string, number>;
    },
    currentBooking: Booking | null,
  ) => {
    if (!currentBooking) {
      return null;
    }

    const updatedBooking = data.bookingsData.find((booking) => booking.id === currentBooking.id);
    if (updatedBooking) {
      if (activeTab === "bookings") {
        return {
          ...updatedBooking,
          managerDays: currentBooking.managerDays,
          series: currentBooking.series,
          ref: currentBooking.ref,
          client: currentBooking.client,
          groupName: currentBooking.groupName,
          country: currentBooking.country,
        };
      }
      return updatedBooking;
    }

    const guideNameById = new Map(data.guidesData.map((guide) => [guide.id, guide.name]));
    const assignedGuides = Array.from(
      new Set(
        Object.entries(data.itemAssignments)
          .filter(([itemId, guideId]) => itemId.startsWith(`${currentBooking.id}-`) && guideId > 0)
          .map(([, guideId]) => guideNameById.get(guideId))
          .filter((guideName): guideName is string => Boolean(guideName)),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return {
      ...currentBooking,
      assignedGuides,
      confirmedGuides: (currentBooking.confirmedGuides ?? []).filter((guideName) => assignedGuides.includes(guideName)),
      guideStatuses: Object.fromEntries(
        Object.entries(currentBooking.guideStatuses ?? {}).filter(([guideName]) => assignedGuides.includes(guideName)),
      ),
    };
  };

  const selectedCountryXidNumber = selectedCountryXid ? Number(selectedCountryXid) : null;

  const fetchTimelineData = async (range?: { from?: string; to?: string }) => {
    const query =
      activeTab === "calendar"
        ? selectedCountryXidNumber
          ? { ...range, countryXid: selectedCountryXidNumber }
          : range
        : {
            ...range,
            search: debouncedModalSearchTerm || undefined,
            client: debouncedModalFilterClient || undefined,
            country: debouncedModalFilterCountry || undefined,
            guide: debouncedModalFilterGuide || undefined,
            series: modalFilterSeries,
            seriesTake: BOOKING_SERIES_PAGE_SIZE,
          };
    const requestId = timelineRequestRef.current + 1;
    timelineRequestRef.current = requestId;
    const isBookingsRequest = activeTab === "bookings";
    if (isBookingsRequest) {
      setIsBookingsTableLoading(true);
    }
    try {
      const data = await runTimelineApi(
        "Loading timeline data...",
        () => (isBookingsRequest ? mockApi.getBookingsData(query) : mockApi.getTimelineData(query)),
        !isBookingsRequest,
      );
      if (timelineRequestRef.current === requestId) {
        applyTimelineData(data);
      }
      return data;
    } finally {
      if (isBookingsRequest && timelineRequestRef.current === requestId) {
        setIsBookingsTableLoading(false);
      }
    }
  };

  const refreshTimelineAndBookingManager = async (booking: Booking | null) => {
    const nextTimelineData = await fetchTimelineData();
    if (!booking) {
      return null;
    }

    const refreshedBooking = resolveActiveAssignmentBooking(nextTimelineData, booking) ?? booking;
    return await refreshActiveBookingManager(refreshedBooking);
  };

  const allCountries = useMemo(() => {
    if (countryOptions.length > 0) {
      return countryOptions.map((country) => country.name).sort((left, right) => left.localeCompare(right));
    }

    const countries = new Set<string>();
    bookingsData.forEach((b) => {
      if (b.country) {
        b.country.split(',').forEach(c => countries.add(c.trim()));
      }
    });
    return Array.from(countries).sort();
  }, [bookingsData]);

  const allClients = useMemo(() => {
    const clients = new Set<string>();
    bookingsData.forEach((b) => {
      if (b.client) clients.add(b.client);
    });
    return Array.from(clients).sort();
  }, [bookingsData]);

  const guidesWithTours = useMemo(() => {
    return guidesData.map((g) => {
      const activeTours = bookingsData.filter((b) => b.assignedGuides.includes(g.name));
      return { ...g, tours: activeTours };
    });
  }, [guidesData, bookingsData]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const countries = await runTimelineApi("Loading countries...", () => mockApi.getCountryOptions());
      if (!active) return;
      setCountryOptions(countries);
      if (!selectedCountryXid) {
        const defaultCountry = countries.find(
          (country) => country.name.trim().toLowerCase() === DEFAULT_COUNTRY_NAME.toLowerCase(),
        );
        if (defaultCountry) {
          setSelectedCountryXid(String(defaultCountry.xid));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Number.isNaN(queryGuideId) || queryGuideId <= 0) {
      if (queryTab === "calendar") {
        setFilterGuide("");
        setGuidePage(1);
      }
      return;
    }

    const guideName = guidesData.find((guide) => guide.id === queryGuideId)?.name;
    console.log(guideName);
    
    if (guideName) {
      setFilterGuide(guideName);
      setGuidePage(1);
    }
  }, [guidesData, queryGuideId, queryTab]);

  useEffect(() => {
    if (activeTab !== "calendar") {
      return;
    }

    const preferredDate = filterDateFrom || filterDateTo;
    if (!preferredDate) {
      return;
    }

    const nextYear = Number(preferredDate.slice(0, 4));
    if (!Number.isNaN(nextYear) && nextYear > 0 && nextYear !== currentYear) {
      setCurrentYear(nextYear);
    }
  }, [activeTab, currentYear, filterDateFrom, filterDateTo]);

  useEffect(() => {
    setDraftFilterDateFrom(filterDateFrom);
  }, [filterDateFrom]);

  useEffect(() => {
    setDraftFilterDateTo(filterDateTo);
  }, [filterDateTo]);

  const commitCalendarDateFrom = () => {
    if (draftFilterDateFrom !== filterDateFrom) {
      setFilterDateFrom(draftFilterDateFrom);
      setGuidePage(1);
    }
  };

  const commitCalendarDateTo = () => {
    if (draftFilterDateTo !== filterDateTo) {
      setFilterDateTo(draftFilterDateTo);
      setGuidePage(1);
    }
  };

  const handleCalendarDateKeyDown = (event: KeyboardEvent<HTMLInputElement>, commit: () => void) => {
    if (event.key === "Enter") {
      commit();
    }
  };

  const filteredGuidesList = useMemo(() => {
    return guidesWithTours.filter((guide) =>
      filterGuide ? guide.name.toLowerCase().includes(filterGuide.toLowerCase()) : true,
    );
  }, [guidesWithTours, filterGuide]);

  const paginatedGuides = useMemo(() => filteredGuidesList.slice((guidePage - 1) * GUIDES_PER_PAGE, guidePage * GUIDES_PER_PAGE), [filteredGuidesList, guidePage]);
  const totalGuidePages = Math.max(1, Math.ceil(filteredGuidesList.length / GUIDES_PER_PAGE));

  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [activeAssignmentBooking, setActiveAssignmentBooking] = useState<any | null>(null);
  const [bookingManagerDirty, setBookingManagerDirty] = useState(false);

  const [guideDetailsModalId, setGuideDetailsModalId] = useState<number | null>(null);
  const [detailsModalYear, setDetailsModalYear] = useState(new Date().getFullYear());
  const [guideOverviewFilter, setGuideOverviewFilter] = useState<'total' | 'finished' | 'incoming'>('total');

  const [newBusyFrom, setNewBusyFrom] = useState("");
  const [newBusyTo, setNewBusyTo] = useState("");
  const [newBusyShiftCode, setNewBusyShiftCode] = useState<ShiftCode>("ALL");
  const [pendingDeleteBusyId, setPendingDeleteBusyId] = useState<string | null>(null);
  const [pendingDeleteBusyGuideId, setPendingDeleteBusyGuideId] = useState<number | null>(null);

  const [selectedItemsToAssign, setSelectedItemsToAssign] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"add" | "remove" | null>(null);

  const [showGuideSelector, setShowGuideSelector] = useState(false);
  const [selectedGuideId, setSelectedGuideId] = useState<number | null>(null);
  const [selectedGuideShiftCode, setSelectedGuideShiftCode] = useState<ShiftCode | null>(null);
  const [guideSearchTerm, setGuideSearchTerm] = useState("");
  const [guideAvailabilityById, setGuideAvailabilityById] = useState<Map<number, GuideAvailability>>(new Map());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [showUnassignDialog, setShowUnassignDialog] = useState(false);
  const [pendingUnassignGuide, setPendingUnassignGuide] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed": case "paid": case "book": case "booked":
        return <span className="text-[#1D3663] font-bold uppercase text-[10px] tracking-widest">Confirmed</span>;
      case "requested": case "on request":
        return <span className="text-[#F3796A] font-bold uppercase text-[10px] tracking-widest">On Request</span>;
      case "cancelled": case "canceled":
        return <span className="text-[#1D3663]/45 font-bold uppercase text-[10px] tracking-widest line-through">Cancelled</span>;
      default:
        return <span className="text-[#1D3663]/70 font-bold uppercase text-[10px] tracking-widest">{status}</span>;
    }
  };

  const isCancelledEvent = (event: any) => event.type === "tour" && event.data?.status?.toLowerCase() === "cancelled";

  const getEventBarClasses = (event: any) => {
    if (event.type === "busy") return "bg-violet-500 border border-slate-600 text-white";
    if (isCancelledEvent(event)) return "bg-white border border-[#1D3663]/20";
    return event.guideStatus === "confirmed" ? "bg-[#1D3663]" : "bg-[#F3796A]";
  };

  const calendarRange = useMemo(() => {
    const start = filterDateFrom
      ? new Date(`${filterDateFrom}T00:00:00`)
      : new Date(currentYear, 0, 1);
    const end = filterDateTo
      ? new Date(`${filterDateTo}T00:00:00`)
      : new Date(currentYear, 11, 31);

    if (start.getTime() <= end.getTime()) {
      return { start, end };
    }

    return { start: end, end: start };
  }, [currentYear, filterDateFrom, filterDateTo]);

  const rangeStartMs = useMemo(() => calendarRange.start.getTime(), [calendarRange.start]);
  const rangeEndExclusiveMs = useMemo(() => {
    const end = new Date(calendarRange.end);
    end.setDate(end.getDate() + 1);
    return end.getTime();
  }, [calendarRange.end]);
  const totalDaysInRange = useMemo(
    () => Math.max(1, Math.round((rangeEndExclusiveMs - rangeStartMs) / 86400000)),
    [rangeEndExclusiveMs, rangeStartMs],
  );

  const displayedDays = useMemo(() => {
    const days: Date[] = [];
    const cursor = new Date(calendarRange.start);
    while (cursor.getTime() <= calendarRange.end.getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [calendarRange.end, calendarRange.start]);

  const displayedMonthSegments = useMemo(() => {
    const segments: Array<{ key: string; label: string; days: number }> = [];
    displayedDays.forEach((date) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const lastSegment = segments[segments.length - 1];
      if (lastSegment?.key === monthKey) {
        lastSegment.days += 1;
        return;
      }

      segments.push({
        key: monthKey,
        label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
        days: 1,
      });
    });
    return segments;
  }, [displayedDays]);

  const isDaily = zoomLevel === 3;
  const currentCellWidth = zoomLevel === 3 ? 40 : 20;

  const timelineTrackStyle = useMemo(() => {
    if (zoomLevel === 1) return { flex: 1, minWidth: "800px" };
    if (zoomLevel === 2) return { width: "250vw", flexShrink: 0 };
    return { width: `${totalDaysInRange * currentCellWidth}px`, flexShrink: 0 };
  }, [zoomLevel, totalDaysInRange, currentCellWidth]);

  useEffect(() => {
    const syncVisibleRange = (force = false) => {
      const container = timelineScrollRef.current;
      if (!container) return;

      const scrollLeft = container.scrollLeft;
      if (!force && lastTimelineScrollLeftRef.current === scrollLeft) {
        return;
      }

      lastTimelineScrollLeftRef.current = scrollLeft;
      const clientWidth = container.clientWidth;

      const leftIndex = Math.floor(scrollLeft / currentCellWidth);
      const rightIndex = Math.floor((scrollLeft + clientWidth - 260) / currentCellWidth);

      const safeLeftIndex = Math.max(0, Math.min(displayedDays.length - 1, leftIndex));
      const safeRightIndex = Math.max(0, Math.min(displayedDays.length - 1, rightIndex));

      const formatDate = (date: Date) => {
        if (!date) return "";
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      };

      setVisibleDateStart(formatDate(displayedDays[safeLeftIndex]));
      setVisibleDateEnd(formatDate(displayedDays[safeRightIndex]));
    };

    const container = timelineScrollRef.current;
    if (container && isDaily) {
      syncVisibleRange(true);
      const handleScroll = () => syncVisibleRange();
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [zoomLevel, currentYear, displayedDays, currentCellWidth, isDaily]);

  useEffect(() => {
    if (activeTab !== "calendar") {
      return;
    }

    if (!selectedCountryXidNumber) {
      timelineRequestRef.current += 1;
      clearTimelineData();
    }
  }, [activeTab, selectedCountryXidNumber]);

  useEffect(() => {
    if (activeTab === "calendar" && !selectedCountryXidNumber) {
      return;
    }

    if (activeTab === "bookings") {
      void fetchTimelineData({
        from: modalFilterDateFrom || `${currentYear}-01-01`,
        to: modalFilterDateTo || `${currentYear}-12-31`,
      });
      return;
    }

    const from = filterDateFrom || `${currentYear}-01-01`;
    const to = filterDateTo || `${currentYear}-12-31`;

    if (activeTab === "calendar") {
      void fetchTimelineData({ from, to });
    }
  }, [
    activeTab,
    currentYear,
    filterDateFrom,
    filterDateTo,
    isDaily,
    debouncedModalFilterClient,
    debouncedModalFilterCountry,
    modalFilterDateFrom,
    modalFilterDateTo,
    debouncedModalFilterGuide,
    modalFilterSeries,
    debouncedModalSearchTerm,
    selectedCountryXidNumber,
  ]);

  const getSeriesStats = (bookingsInSeries: Booking[]) => {
    const total = bookingsInSeries.length;
    const assigned = bookingsInSeries.filter((b) => b.assignedGuides.length > 0).length;
    return {
      total, assigned, notAssigned: total - assigned,
      cancelled: bookingsInSeries.filter(b => b.status.toLowerCase().includes("cancel")).length,
      onRequest: bookingsInSeries.filter(b => b.status.toLowerCase().includes("request")).length,
      confirmed: bookingsInSeries.filter(b => ["confirmed", "paid", "book", "booked"].includes(b.status.toLowerCase())).length,
    };
  };

  const groupedBySeries = useMemo(() => {
    const grouped: Record<string, Booking[]> = {};
    bookingSeries.forEach((series) => {
      grouped[series.series] = [];
    });
    bookingsData.forEach((b) => {
      let series = getBookingSeriesName(b);
      if (!grouped[series]) grouped[series] = [];
      grouped[series].push(b);
    });
    Object.keys(grouped).forEach((s) => grouped[s].sort((a, b) => new Date(a.startDay).getTime() - new Date(b.startDay).getTime()));
    return grouped;
  }, [bookingSeries, bookingsData]);

  const buildBookingsTimelineQuery = (range?: { from?: string; to?: string }) => ({
    from: range?.from ?? (modalFilterDateFrom || `${currentYear}-01-01`),
    to: range?.to ?? (modalFilterDateTo || `${currentYear}-12-31`),
    search: debouncedModalSearchTerm || undefined,
    client: debouncedModalFilterClient || undefined,
    country: debouncedModalFilterCountry || undefined,
    guide: debouncedModalFilterGuide || undefined,
    series: modalFilterSeries,
    seriesTake: BOOKING_SERIES_PAGE_SIZE,
  });

  const refreshBookingSeriesPage = async (booking: Booking | null) => {
    if (!booking || activeTab !== "bookings") {
      return;
    }

    const series = getBookingSeriesName(booking);
    const loadedCount = groupedBySeries[series]?.length ?? 0;
    setLoadingBookingSeries((current) => (current.includes(series) ? current : [...current, series]));
    try {
      const nextTimelineData = await runTimelineApi("Refreshing booking data...", () =>
      mockApi.getBookingsData({
        ...buildBookingsTimelineQuery(),
        loadSeries: series,
        seriesSkip: 0,
        seriesTake: Math.max(loadedCount, BOOKING_SERIES_PAGE_SIZE),
      }),
      false,
      );

      applyTimelineSupportData(nextTimelineData);
      setBookingsData((current) => {
        const preserved = current.filter((item) => getBookingSeriesName(item) !== series);
        return [...preserved, ...nextTimelineData.bookingsData];
      });
    } finally {
      setLoadingBookingSeries((current) => current.filter((item) => item !== series));
    }
  };

  const fetchLatestBookingForManager = async (booking: Booking) => {
    if (activeTab !== "bookings") {
      return bookingsData.find((item) => item.id === booking.id) ?? booking;
    }

    const series = getBookingSeriesName(booking);
    const loadedCount = groupedBySeries[series]?.length ?? 0;
    setLoadingManageBookingId(booking.id);
    try {
      const nextTimelineData = await runTimelineApi("Loading latest booking details...", () =>
        mockApi.getBookingsData({
          ...buildBookingsTimelineQuery(),
          loadSeries: series,
          seriesSkip: 0,
          seriesTake: Math.max(loadedCount, BOOKING_SERIES_PAGE_SIZE),
        }),
      false,
      );

      applyTimelineSupportData(nextTimelineData);
      setBookingsData((current) => {
        const preserved = current.filter((item) => getBookingSeriesName(item) !== series);
        return [...preserved, ...nextTimelineData.bookingsData];
      });

      return resolveActiveAssignmentBooking(nextTimelineData, booking) ?? booking;
    } finally {
      setLoadingManageBookingId((current) => (current === booking.id ? null : current));
    }
  };

  const syncBookingManagerMutation = (
    nextTimelineData: {
      bookingsData: Booking[];
      bookingSeries: TimelineBookingSeries[];
      guidesData: Guide[];
      itemAssignments: Record<string, number>;
      itemTimeSlots: Record<string, ServiceDayPart>;
      emailRecords: Record<string, GuideEmailRecord>;
      guideTimeExceptions: GuideTimeException[];
    },
    currentBooking: Booking | null,
  ) => {
    applyTimelineSupportData(nextTimelineData);

    const updatedBooking = resolveActiveAssignmentBooking(nextTimelineData, currentBooking);
    if (updatedBooking) {
      setBookingsData((current) =>
        current.some((item) => item.id === updatedBooking.id)
          ? current.map((item) => (item.id === updatedBooking.id ? updatedBooking : item))
          : [...current, updatedBooking],
      );
    }

    setBookingManagerDirty(true);
    return updatedBooking;
  };

  const handleLoadMoreBookingSeries = async (series: string, loadedCount: number) => {
    if (activeTab !== "bookings") {
      return;
    }

    const requestKey = `${series}:${loadedCount}`;
    if (pendingSeriesLoadRef.current.has(requestKey)) {
      return;
    }
    pendingSeriesLoadRef.current.add(requestKey);
    setLoadingBookingSeries((current) => (current.includes(series) ? current : [...current, series]));

    try {
      const nextTimelineData = await runTimelineApi("Loading more bookings...", () =>
        mockApi.getBookingsData({
          ...buildBookingsTimelineQuery(),
          loadSeries: series,
          seriesSkip: loadedCount,
          seriesTake: BOOKING_SERIES_PAGE_SIZE,
        }),
      false,
      );

      setBookingsData((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const merged = [...current];
        nextTimelineData.bookingsData.forEach((item) => {
          if (!existingIds.has(item.id)) {
            merged.push(item);
            existingIds.add(item.id);
          }
        });
        return merged;
      });
    } finally {
      pendingSeriesLoadRef.current.delete(requestKey);
      setLoadingBookingSeries((current) => current.filter((item) => item !== series));
    }
  };

  const toggleSeriesAccordion = (series: string) => {
    setExpandedSeries((prev) => { const next = new Set(prev); if (next.has(series)) next.delete(series); else next.add(series); return next; });
  };

  const dailyColumns = useMemo(() => {
    if (!activeAssignmentBooking) return [];
    const sourceDays = activeAssignmentBooking.managerDays !== undefined
      ? activeAssignmentBooking.managerDays
      : (() => {
          const days = [];
          let current = new Date(`${activeAssignmentBooking.startDay}T00:00:00`);
          for (let i = 0; i < activeAssignmentBooking.duration; i++) {
            const dateStr = current.toISOString().split("T")[0];
            const dayNum = i + 1;
            const bId = activeAssignmentBooking.id;

            const items = [
              { id: `${bId}-d${dayNum}-hd`, type: "TYO\\HD Guide" },
              { id: `${bId}-d${dayNum}-lunch`, type: "TYO\\Lunch for Guide in a local restaurant near the city's river" },
            ];

            if (i !== activeAssignmentBooking.duration - 1) {
              items.push({ id: `${bId}-d${dayNum}-dinner`, type: "TYO\\Dinner for Guide" });
            }

            if (i === 0 || i === activeAssignmentBooking.duration - 1) {
              items.push({ id: `${bId}-d${dayNum}-trf`, type: "TYOAirport Transfer Guide" });
            }

            days.push({ dayNum, dateStr, items });
            current.setDate(current.getDate() + 1);
          }

          return days;
        })();

    return sourceDays.map((day) => {
      const enrichedItems = day.items.map((item) => {
        const assignedGuideId = itemAssignments[item.id];
        const assignedGuideName = assignedGuideId ? guidesData.find((g) => g.id === assignedGuideId)?.name : null;
        const slot = itemTimeSlots[item.id] ?? "full-day";
        return { ...item, assignedGuideName, slot };
      });
      const firstGuide = enrichedItems[0]?.assignedGuideName;
      const isAllSameGuide = enrichedItems.length > 0 && firstGuide && enrichedItems.every((item) => item.assignedGuideName === firstGuide);
      return { ...day, items: enrichedItems, isAllSameGuide, dayGuideName: isAllSameGuide ? firstGuide : null };
    });
  }, [activeAssignmentBooking, itemAssignments, itemTimeSlots, guidesData]);

  const serviceDateByItemId = useMemo(() => {
    const result = new Map<string, string>();
    dailyColumns.forEach((day: any) => {
      day.items.forEach((item: any) => {
        result.set(item.id, day.dateStr);
      });
    });
    return result;
  }, [dailyColumns]);

  const getTargetServiceIds = () =>
    (selectedItemsToAssign.size > 0
      ? Array.from(selectedItemsToAssign)
      : dailyColumns.flatMap((day: any) => day.items.map((item: any) => item.id)))
      .map((itemId) => Number(itemId))
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

  const handleItemMouseDown = (itemId: string) => {
    setIsDragging(true); const mode = selectedItemsToAssign.has(itemId) ? "remove" : "add";
    setDragMode(mode); setSelectedItemsToAssign(prev => { const next = new Set(prev); mode === "add" ? next.add(itemId) : next.delete(itemId); return next; });
  };

  const handleItemMouseEnter = (itemId: string) => {
    if (!isDragging || !dragMode) return;
    setSelectedItemsToAssign(prev => { const next = new Set(prev); dragMode === "add" ? next.add(itemId) : next.delete(itemId); return next; });
  };

  const handleSelectAll = () => {
    if (!activeAssignmentBooking) return;
    const allItemIds = dailyColumns.flatMap((d: any) => d.items.map((i: any) => i.id));
    setSelectedItemsToAssign(selectedItemsToAssign.size === allItemIds.length ? new Set() : new Set(allItemIds));
  };

  const handleSelectDay = (dayNum: number) => {
    const dayItemIds = dailyColumns.find((d: any) => d.dayNum === dayNum)?.items.map((i: any) => i.id) || [];
    const allDaySelected = dayItemIds.every((id: string) => selectedItemsToAssign.has(id));
    setSelectedItemsToAssign(prev => { const next = new Set(prev); dayItemIds.forEach((id: string) => allDaySelected ? next.delete(id) : next.add(id)); return next; });
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => { setIsDragging(false); setDragMode(null); };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const handleAddBusyDate = async () => {
    const targetGuide = guidesWithTours.find(g => g.id === guideDetailsModalId);
    if (!newBusyFrom || !newBusyTo || !targetGuide) return;
    const newBusyFromMs = new Date(newBusyFrom).getTime();
    const newBusyToMs = new Date(newBusyTo).getTime();
    if (newBusyFromMs > newBusyToMs) { alert("From date must be before To date."); return; }

    const overlappingBusyBlock = targetGuide.busyDates.find((busyDate) => {
      const busyFromMs = new Date(`${busyDate.from}T00:00:00`).getTime();
      const busyToMs = new Date(`${busyDate.to}T00:00:00`).getTime();
      return checkOverlap(newBusyFromMs, newBusyToMs, busyFromMs, busyToMs);
    });
    if (overlappingBusyBlock) {
      alert("This busy block overlaps with an existing busy block. Please choose another date range.");
      return;
    }

    let overlappingTour: Booking | null = null;
    for (const t of targetGuide.tours) {
      if (t.status?.toLowerCase() === "cancelled") continue;
      const tourStartMs = new Date(t.startDay).getTime();
      const tourEndMs = tourStartMs + (t.duration - 1) * 86400000;
      if (checkOverlap(newBusyFromMs, newBusyToMs, tourStartMs, tourEndMs)) { overlappingTour = t; break; }
    }
    if (overlappingTour) { alert(`The guide is already on tour for "${overlappingTour.groupName}" on some of those dates. You cannot add a busy block.`); return; }

    const busyDatesToCreate: string[] = [];
    const cursor = new Date(`${newBusyFrom}T00:00:00`);
    const end = new Date(`${newBusyTo}T00:00:00`);
    while (cursor.getTime() <= end.getTime()) {
      busyDatesToCreate.push(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    await runTimelineApi("Saving busy dates...", async () => {
      for (const date of busyDatesToCreate) {
        await mockApi.markGuidePersonalBusy(guideDetailsModalId, date, newBusyShiftCode);
      }
    });

    await fetchTimelineData();
    setNewBusyFrom("");
    setNewBusyTo("");
    setNewBusyShiftCode("ALL");
  };

  const handleRemoveBusyDate = (id: string, guideId: number) => { setPendingDeleteBusyId(id); setPendingDeleteBusyGuideId(guideId); };

  const handleConfirmUnassignGuide = async () => {
    if (!activeAssignmentBooking || !pendingUnassignGuide) return;
    const guideId = guidesData.find((guide) => guide.name === pendingUnassignGuide)?.id;
    if (!guideId) return;

    const serviceIds = dailyColumns
      .flatMap((day: any) => day.items)
      .filter((item: any) => itemAssignments[item.id] === guideId)
      .map((item: any) => Number(item.id))
      .filter((serviceId) => Number.isInteger(serviceId) && serviceId > 0);

    await runTimelineApi("Unassigning guide...", async () => {
      for (const serviceId of serviceIds) {
        await mockApi.unassignGuideFromService(serviceId, guideId);
      }
    });

    const updatedBooking = await refreshTimelineAndBookingManager(activeAssignmentBooking);
    setActiveAssignmentBooking(updatedBooking);
    setBookingManagerDirty(true);
    setPendingUnassignGuide(null); setShowUnassignDialog(false);
  };

  const filteredGuidesForModal = useMemo(() => {
    if (!guideSearchTerm.trim()) return guidesWithTours.slice(0, 30);
    const term = guideSearchTerm.toLowerCase();
    return guidesWithTours.filter((g: any) => g.name.toLowerCase().includes(term) || g.tags.some((t: string) => t.toLowerCase().includes(term))).slice(0, 30);
  }, [guideSearchTerm, guidesWithTours]);

  const expandServiceDayPart = (slot: ServiceDayPart) =>
    slot === "full-day" ? ["morning", "afternoon", "evening"] : [slot];

  const formatServiceDayPartLabel = (slot: string) => {
    if (slot === "evening") return "Evening";
    return slot.charAt(0).toUpperCase() + slot.slice(1);
  };

  const getDatesForItemIds = (bookingStartDay: string, itemIds: string[]) => {
    const dates = new Set<string>();
    itemIds.forEach((itemId) => {
      const match = itemId.match(/-d(\d+)-/);
      if (!match) return;
      const date = new Date(`${bookingStartDay}T00:00:00`);
      date.setDate(date.getDate() + (Number(match[1]) - 1));
      dates.add(toDateKey(date));
    });
    return Array.from(dates).sort();
  };

  const getTargetItemIds = () => Array.from(selectedItemsToAssign);

  useEffect(() => {
    if (!showGuideSelector || !activeAssignmentBooking) {
      setAvailabilityLoading(false);
      setAvailabilityError(null);
      setGuideAvailabilityById(new Map());
      return;
    }

    const targetItemIds = getTargetItemIds();
    const targetDates = Array.from(
      new Set(
        targetItemIds
          .map((itemId) => serviceDateByItemId.get(itemId))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (targetDates.length === 0) {
      setAvailabilityError("No service dates were found for the selected services.");
      setGuideAvailabilityById(new Map());
      return;
    }

    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    void (async () => {
      try {
        const availabilityResponses = await Promise.all(
          targetDates.map((date) => mockApi.searchAvailableGuides(date, "ALL")),
        );

        if (!active) {
          return;
        }

        const aggregatedAvailability = new Map<number, GuideAvailability>();

        availabilityResponses.forEach((guides, responseIndex) => {
          guides.forEach((guide) => {
            const dateAvailableShifts = guide.availableShiftCodes.filter((shiftCode) => shiftCode !== "ALL");
            const dateBusyShifts = guide.busyShiftCodes.filter((shiftCode) => shiftCode !== "ALL");
            const current = aggregatedAvailability.get(guide.guideId);

            if (!current) {
              aggregatedAvailability.set(guide.guideId, {
                label: "Available",
                color: "text-[#1D3663]",
                selectable: dateAvailableShifts.length > 0,
                requiresShiftSelection: dateBusyShifts.length > 0,
                availableShiftCodes: [...dateAvailableShifts],
                busyShiftCodes: [...dateBusyShifts],
              });
              return;
            }

            const nextAvailableShifts = current.availableShiftCodes.filter((shiftCode) =>
              dateAvailableShifts.includes(shiftCode),
            );
            const nextBusyShifts = Array.from(new Set([...current.busyShiftCodes, ...dateBusyShifts])).sort();

            aggregatedAvailability.set(guide.guideId, {
              ...current,
              selectable: nextAvailableShifts.length > 0,
              requiresShiftSelection: current.requiresShiftSelection || dateBusyShifts.length > 0,
              availableShiftCodes: nextAvailableShifts,
              busyShiftCodes: nextBusyShifts,
            });
          });

          if (responseIndex > 0) {
            Array.from(aggregatedAvailability.keys()).forEach((guideId) => {
              if (!guides.some((guide) => guide.guideId === guideId)) {
                aggregatedAvailability.set(guideId, {
                  label: "Busy",
                  color: "text-[#F3796A]",
                  selectable: false,
                  requiresShiftSelection: true,
                  availableShiftCodes: [],
                  busyShiftCodes: CONCRETE_SHIFT_OPTIONS.map((option) => option.value),
                });
              }
            });
          }
        });

        const nextAvailabilityById = new Map<number, GuideAvailability>();
        aggregatedAvailability.forEach((availability, guideId) => {
          const isFullyFree = availability.availableShiftCodes.length === CONCRETE_SHIFT_OPTIONS.length
            && availability.busyShiftCodes.length === 0;
          const isSelectable = availability.availableShiftCodes.length > 0;

          nextAvailabilityById.set(guideId, {
            ...availability,
            label: isSelectable
              ? availability.requiresShiftSelection ? "Select shift" : "Available"
              : "Busy",
            color: isSelectable ? "text-[#1D3663]" : "text-[#F3796A]",
            selectable: isSelectable,
            requiresShiftSelection: !isFullyFree && availability.requiresShiftSelection,
          });
        });

        setGuideAvailabilityById(nextAvailabilityById);
      } catch (error) {
        if (!active) {
          return;
        }

        setGuideAvailabilityById(new Map());
        setAvailabilityError(error instanceof Error ? error.message : "Unable to load available guides.");
      } finally {
        if (active) {
          setAvailabilityLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
    
  }, [activeAssignmentBooking, selectedItemsToAssign, serviceDateByItemId, showGuideSelector]);

  useEffect(() => {
    if (!selectedGuideId) {
      return;
    }

    const availability = guideAvailabilityById.get(selectedGuideId);
    if (!availability?.selectable) {
      setSelectedGuideId(null);
      setSelectedGuideShiftCode(null);
      return;
    }

    if (
      availability.requiresShiftSelection &&
      (!selectedGuideShiftCode || !availability.availableShiftCodes.includes(selectedGuideShiftCode))
    ) {
      setSelectedGuideShiftCode(null);
      return;
    }

    if (!availability.requiresShiftSelection && selectedGuideShiftCode !== "ALL") {
      setSelectedGuideShiftCode("ALL");
    }
  }, [guideAvailabilityById, selectedGuideId, selectedGuideShiftCode]);

  const getGuideAssignedDatesForBooking = (guideId: number) => {
    return Array.from(
      new Set(
        dailyColumns
          .flatMap((day: any) =>
            day.items
              .filter((item: any) => itemAssignments[item.id] === guideId)
              .map(() => day.dateStr),
          ),
      ),
    ).sort();
  };

  const buildGuideOccupation = (guide: any, excludedItemIds = new Set<string>()) => {
    const occupiedSlots = new Map<string, Set<string>>();
    const fullDayBlocks = new Set<string>();
    const timeRanges = new Map<string, GuideTimeException[]>();
    const markOccupied = (dateKey: string, slot: ServiceDayPart) => {
      const next = occupiedSlots.get(dateKey) ?? new Set<string>();
      expandServiceDayPart(slot).forEach((value) => next.add(value));
      occupiedSlots.set(dateKey, next);
    };
    const markFullDay = (dateKey: string) => {
      fullDayBlocks.add(dateKey);
      markOccupied(dateKey, "full-day");
    };

    guide.busyDates.forEach((busyDate: BusyDate) => {
      const current = new Date(`${busyDate.from}T00:00:00`);
      const end = new Date(`${busyDate.to}T00:00:00`);
      while (current.getTime() <= end.getTime()) {
        markFullDay(toDateKey(current));
        current.setDate(current.getDate() + 1);
      }
    });

    guide.tours.forEach((tour: any) => {
      if (tour.status?.toLowerCase() === "cancelled") return;

      const allAssignedEntries = Object.entries(itemAssignments).filter(
        ([itemId, guideId]) => itemId.startsWith(`${tour.id}-`) && guideId === guide.id,
      );
      const assignedEntries = allAssignedEntries.filter(([itemId]) => !excludedItemIds.has(itemId));

      if (allAssignedEntries.length === 0) {
        const current = new Date(`${tour.startDay}T00:00:00`);
        for (let day = 0; day < tour.duration; day += 1) {
          markFullDay(toDateKey(current));
          current.setDate(current.getDate() + 1);
        }
        return;
      }

      if (assignedEntries.length === 0) return;

      const assignedDates = new Set<string>();
      assignedEntries.forEach(([itemId]) => {
        const dayMatch = itemId.match(/-d(\d+)-/);
        if (!dayMatch) return;
        const date = new Date(`${tour.startDay}T00:00:00`);
        date.setDate(date.getDate() + (Number(dayMatch[1]) - 1));
        const dateKey = toDateKey(date);
        assignedDates.add(dateKey);
        markOccupied(dateKey, itemTimeSlots[itemId] ?? "full-day");
      });

      assignedDates.forEach((dateKey) => {
        const exceptions = (guide.timeExceptions ?? []).filter(
          (exception) => exception.bookingId === tour.id && exception.date === dateKey,
        );
        if (exceptions.length === 0) {
          markFullDay(dateKey);
          return;
        }
        timeRanges.set(dateKey, [...(timeRanges.get(dateKey) ?? []), ...exceptions]);
      });
    });

    return { occupiedSlots, fullDayBlocks, timeRanges };
  };

  const getGuideAvailability = (guide: any) => {
    if (!showGuideSelector) {
      return {
        label: "Available",
        color: "text-[#1D3663]",
        selectable: true,
        requiresTimeInput: false,
        requiresShiftSelection: false,
        availableShiftCodes: CONCRETE_SHIFT_OPTIONS.map((option) => option.value),
        busyShiftCodes: [],
      };
    }

    if (availabilityLoading) {
      return {
        label: "Checking...",
        color: "text-[#1D3663]",
        selectable: false,
        requiresTimeInput: false,
        requiresShiftSelection: false,
        availableShiftCodes: [],
        busyShiftCodes: [],
      };
    }

    return guideAvailabilityById.get(guide.id) ?? {
      label: "Busy",
      color: "text-[#F3796A]",
      selectable: false,
      requiresTimeInput: false,
      requiresShiftSelection: false,
      availableShiftCodes: [],
      busyShiftCodes: CONCRETE_SHIFT_OPTIONS.map((option) => option.value),
    };
  };
  const handleClearBookingFilters = () => {
    setModalSearchTerm("");
    setModalFilterCountry(DEFAULT_COUNTRY_NAME);
    setModalFilterClient("");
    setModalFilterGuide("");
    setModalFilterDateFrom(defaultMonthRange.from);
    setModalFilterDateTo(defaultMonthRange.to);
    setModalFilterSeries("all");
  };

  const handleOpenBookingManager = async (booking: any) => {
    const requestId = bookingManagerRequestRef.current + 1;
    bookingManagerRequestRef.current = requestId;
    const selectedBooking = bookingsData.find((item) => item.id === booking.id) ?? booking;
    if (bookingManagerRequestRef.current !== requestId) {
      return;
    }
    const bookingWithManager = await refreshActiveBookingManager(selectedBooking);
    if (bookingManagerRequestRef.current !== requestId) {
      return;
    }
    setActiveAssignmentBooking(bookingWithManager);
    setBookingManagerDirty(false);
    setSelectedItemsToAssign(new Set());
    setShowGuideSelector(false);
    setSelectedGuideId(null);
    setSelectedGuideShiftCode(null);
    setEmailComposerState(null);
  };

  const handleCloseBookingManager = () => {
    const bookingToRefresh = activeAssignmentBooking;
    const shouldRefreshSeries = bookingManagerDirty;
    setActiveAssignmentBooking(null);
    setBookingManagerDirty(false);
    setSelectedItemsToAssign(new Set());
    setShowGuideSelector(false);
    setShowUnassignDialog(false);
    setPendingUnassignGuide(null);
    setSelectedGuideId(null);
    setSelectedGuideShiftCode(null);
    setEmailComposerState(null);
    if (shouldRefreshSeries) {
      void refreshBookingSeriesPage(bookingToRefresh);
    }
  };

  const handleDismissBookingManager = () => {
    setActiveAssignmentBooking(null);
    setBookingManagerDirty(false);
    setSelectedItemsToAssign(new Set());
    setShowGuideSelector(false);
    setSelectedGuideId(null);
    setSelectedGuideShiftCode(null);
    setEmailComposerState(null);
  };

  const handleRequestGuideStatusChange = (bookingId: string, guideName: string, isConfirmed: boolean) => {
    if (isConfirmed) return;
    const booking = bookingsData.find((item) => item.id === bookingId);
    if (!booking) return;
    setPendingGuideStatusChange({
      bookingId,
      bookingRef: booking.ref,
      guideName,
      isConfirmed,
    });
  };

  const handleConfirmGuideStatusChange = async () => {
    if (!pendingGuideStatusChange) return;
    const guideId = guidesData.find((guide) => guide.name === pendingGuideStatusChange.guideName)?.id;
    if (!guideId || !activeAssignmentBooking) return;

    const serviceIds = dailyColumns
      .flatMap((day: any) => day.items)
      .filter((item: any) => itemAssignments[item.id] === guideId)
      .map((item: any) => Number(item.id))
      .filter((serviceId) => Number.isInteger(serviceId) && serviceId > 0);

    await runTimelineApi("Updating guide status...", async () => {
      for (const serviceId of serviceIds) {
        await mockApi.confirmServiceGuide(serviceId);
      }
    });

    const updatedBooking = await refreshTimelineAndBookingManager(activeAssignmentBooking);
    if (updatedBooking) {
      setActiveAssignmentBooking(updatedBooking);
    }

    setPendingGuideStatusChange(null);
  };

  const handleOpenEmailComposer = (guideId: number, guideName: string) => {
    if (!activeAssignmentBooking) return;
    const emailRecord = emailRecords[buildGuideEmailKey(activeAssignmentBooking.id, guideId)];
    setEmailComposerState({
      bookingId: activeAssignmentBooking.id,
      bookingRef: activeAssignmentBooking.ref,
      guideId,
      guideName,
      date: emailRecord?.date ?? new Date().toISOString().split("T")[0],
      subject: emailRecord?.subject ?? `${activeAssignmentBooking.client} | ${activeAssignmentBooking.groupName} | ${guideName}`,
      body:
        emailRecord?.body ??
        `Hello ${guideName},\n\nPlease review the guide arrangement for ${activeAssignmentBooking.groupName} (${activeAssignmentBooking.client}) starting ${activeAssignmentBooking.startDay}.\n\nBest regards,`,
      actionLabel: emailRecord?.status,
    });
  };

  const handleSaveEmailRecord = async (status: "draft" | "sent") => {
    if (!emailComposerState) return;
    const nextTimelineData = await runTimelineApi("Saving email record...", () =>
      mockApi.setGuideEmailRecord(emailComposerState.bookingId, emailComposerState.guideId, {
        status,
        date: emailComposerState.date,
        subject: emailComposerState.subject,
        body: emailComposerState.body,
      }),
    );
    applyTimelineSupportData(nextTimelineData);

    if (activeAssignmentBooking?.id === emailComposerState.bookingId) {
      const updatedBooking = resolveActiveAssignmentBooking(nextTimelineData, activeAssignmentBooking);
      setActiveAssignmentBooking(updatedBooking);
    }

    setEmailComposerState(null);
  };

  const handleItemTimeSlotChange = async (itemId: string, slot: ServiceDayPart) => {
    const nextTimelineData = await runTimelineApi("Updating item timing...", () =>
      mockApi.setBookingItemTimeSlot(itemId, slot),
    );
    applyTimelineData(nextTimelineData);
  };

  const selectedAssignedGuideNames = useMemo(() => {
    const guideNames = new Set<string>();
    let hasUnassigned = false;

    selectedItemsToAssign.forEach((itemId) => {
      const assignedGuideId = itemAssignments[itemId];
      if (!assignedGuideId) {
        hasUnassigned = true;
        return;
      }
      const guideName = guidesData.find((guide) => guide.id === assignedGuideId)?.name;
      if (!guideName) {
        hasUnassigned = true;
        return;
      }
      guideNames.add(guideName);
    });

    return {
      hasAssignedItems: guideNames.size > 0,
      hasOnlyAssignedItems: !hasUnassigned && selectedItemsToAssign.size > 0,
      guideNames: Array.from(guideNames),
    };
  }, [selectedItemsToAssign, itemAssignments, guidesData]);

  const handleClearSelectedItems = () => {
    setSelectedItemsToAssign(new Set());
  };

  const handleUnassignSelectedItems = async () => {
    if (!activeAssignmentBooking || selectedItemsToAssign.size === 0) return;
    if (selectedAssignedGuideNames.guideNames.length !== 1) return;

    const guideId = guidesData.find((guide) => guide.name === selectedAssignedGuideNames.guideNames[0])?.id;
    if (!guideId) return;

    const serviceIds = Array.from(selectedItemsToAssign)
      .map((itemId) => Number(itemId))
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

    await runTimelineApi("Unassigning selected items...", async () => {
      for (const serviceId of serviceIds) {
        await mockApi.unassignGuideFromService(serviceId, guideId);
      }
    });

    const updatedBooking = await refreshTimelineAndBookingManager(activeAssignmentBooking);
    setActiveAssignmentBooking(updatedBooking);
    setBookingManagerDirty(true);
    setSelectedItemsToAssign(new Set());
    setSelectedGuideId(null);
    setShowGuideSelector(false);
  };

  const openGuideTimingEditor = async (guideId: number, guideName: string) => {
    if (!activeAssignmentBooking) return;
    const dates = getGuideAssignedDatesForBooking(guideId);
    const savedShifts = await runTimelineApi("Loading guide shifts...", () =>
      mockApi.getGuideBookingShifts(activeAssignmentBooking.id, guideId),
    );
    const existingByDate = new Map(savedShifts.map((entry) => [entry.date, entry.shift]));

    setGuideTimingModalState({
      guideId,
      guideName,
      bookingId: activeAssignmentBooking.id,
      title: `Shift for ${guideName}`,
      submitLabel: "Save Shift",
      description: "Choose the working shift for each assigned day. Saving updates the matching M_GuideBusy records for this guide.",
      drafts: dates.map((date) => ({
        date,
        shift: existingByDate.get(date) ?? "ALL",
      })),
    });
  };

  const handleSelectGuide = (guideId: number) => {
    const availability = guideAvailabilityById.get(guideId);
    if (!availability?.selectable) return;
    if (availability.requiresShiftSelection) return;
    setSelectedGuideId(guideId);
    setSelectedGuideShiftCode("ALL");
  };

  const handleSelectGuideShift = (guideId: number, shiftCode: ShiftCode) => {
    const availability = guideAvailabilityById.get(guideId);
    if (!availability?.selectable || !availability.availableShiftCodes.includes(shiftCode)) {
      return;
    }

    setSelectedGuideId(guideId);
    setSelectedGuideShiftCode(shiftCode);
  };

  const handleGuideTimingDraftChange = (date: string, shift: ShiftCode) => {
    setGuideTimingModalState((current) => {
      if (!current) return current;
      return {
        ...current,
        drafts: current.drafts.map((draft) => (draft.date === date ? { ...draft, shift } : draft)),
      };
    });
  };

  const handleCloseGuideTimingModal = () => {
    setGuideTimingModalState(null);
  };

  const handleSaveGuideTiming = async () => {
    if (!guideTimingModalState || !activeAssignmentBooking) return;
    await runTimelineApi("Saving guide shifts...", () =>
      mockApi.setGuideBookingShifts(
        guideTimingModalState.bookingId,
        guideTimingModalState.guideId,
        guideTimingModalState.drafts.map((draft) => ({
          date: draft.date,
          shift: draft.shift,
        })),
      ),
    );

    const updatedBooking = await refreshTimelineAndBookingManager(activeAssignmentBooking);
    setActiveAssignmentBooking(updatedBooking);
    setBookingManagerDirty(true);
    setGuideTimingModalState(null);
  };

  const handleConfirmAssignment = async () => {
    if (!activeAssignmentBooking || !selectedGuideId) return;

    const assignmentItems = getTargetItemIds()
      .map((itemId) => ({
        resHolidayXid: Number(itemId),
        arrDate: serviceDateByItemId.get(itemId) ?? "",
      }))
      .filter(
        (item) =>
          Number.isInteger(item.resHolidayXid) &&
          item.resHolidayXid > 0 &&
          item.arrDate.trim().length > 0,
      );

    if (assignmentItems.length === 0) {
      return;
    }

    await runTimelineApi("Assigning guide...", async () => {
      await mockApi.assignGuideToServices({
        supplierGuideXid: selectedGuideId,
        items: assignmentItems,
        maCa: selectedGuideShiftCode ?? "ALL",
        assignedBy: 1,
        operatorNote: "",
      });
    });

    const updatedBooking = await refreshTimelineAndBookingManager(activeAssignmentBooking);
    setActiveAssignmentBooking(updatedBooking);
    setBookingManagerDirty(true);
    setShowGuideSelector(false);
    setSelectedItemsToAssign(new Set());
    setSelectedGuideId(null);
    setSelectedGuideShiftCode(null);
  };

  const handleStartUnassignGuide = (guideName: string) => {
    setPendingUnassignGuide(guideName);
    setShowUnassignDialog(true);
  };

  const handleCancelUnassignGuide = () => {
    setShowUnassignDialog(false);
    setPendingUnassignGuide(null);
  };

  const detailsGuide = guidesWithTours.find((g: any) => g.id === guideDetailsModalId);

  return (
    <div className="flex flex-col h-screen bg-[#C4E8FF]/20 overflow-hidden font-sans text-[#1D3663] select-none w-full">
      {timelineLoadingCount > 0 && (
        <LoadingOverlay
          label={timelineLoadingLabel}
          className="fixed inset-0 z-[150] bg-[#1D3663]/16 backdrop-blur-[2px] flex items-center justify-center p-4 transition-opacity"
        />
      )}

      {/* GLOBAL STICKY HEADER & TABS */}
      <header className="h-16 bg-white border-b border-[#C4E8FF] flex items-center justify-between px-6 shrink-0 z-50 shadow-sm sticky top-0">
        <div className="flex items-center gap-8 h-full">
          <h1 className="text-xl font-bold text-[#1D3663] mr-4">Guide Management</h1>
          <nav className="flex h-full gap-8">
            <Link to="/timeline?tab=calendar" onClick={() => setActiveTab('calendar')} className={`h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] transition-colors ${activeTab === 'calendar' ? 'border-[#F3796A] text-[#F3796A]' : 'border-transparent text-[#1D3663]/50 hover:text-[#1D3663]'}`}>Calendar</Link>
            <Link to="/timeline?tab=bookings" onClick={() => setActiveTab('bookings')} className={`h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] transition-colors ${activeTab === 'bookings' ? 'border-[#F3796A] text-[#F3796A]' : 'border-transparent text-[#1D3663]/50 hover:text-[#1D3663]'}`}>Bookings</Link>
            <Link to="/guides" className="h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] border-transparent transition-colors text-[#1D3663]/50 hover:text-[#1D3663]">Guides</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-[#1D3663] flex items-center justify-center text-white font-bold text-xs">U</div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative z-0 flex flex-col">

        {/* --- CALENDAR TAB --- */}
        {activeTab === 'calendar' && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#C4E8FF]/10 relative">
            <div className="bg-white px-6 py-3 flex flex-col shrink-0 border-b border-[#C4E8FF] z-20 relative">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#C4E8FF]/50">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-black text-[#1D3663] w-16">{currentYear}</h2>
                  <div className="flex border border-[#C4E8FF] rounded-xl overflow-hidden shadow-sm bg-white mr-4">
                    <button onClick={() => setCurrentYear(prev => prev - 1)} className="p-1.5 hover:bg-[#C4E8FF]/20 border-r border-[#C4E8FF]"><ChevronLeft className="w-4 h-4 text-[#1D3663]" /></button>
                    <button onClick={() => setCurrentYear(prev => prev + 1)} className="p-1.5 hover:bg-[#C4E8FF]/20"><ChevronRight className="w-4 h-4 text-[#1D3663]" /></button>
                  </div>

                  <div className="h-6 w-px bg-[#C4E8FF] mx-1"></div>

                  <div className="flex border border-[#C4E8FF] rounded-xl overflow-hidden shadow-sm bg-white ml-2">
                    <button disabled={guidePage === 1} onClick={() => setGuidePage((p) => Math.max(1, p - 1))} className="px-2 hover:bg-[#C4E8FF]/20 border-r border-[#C4E8FF] disabled:opacity-30"><ChevronLeft className="w-3 h-3 text-[#1D3663]" /></button>
                    <span className="px-3 py-1 text-[9px] font-black text-[#1D3663] bg-[#C4E8FF]/20 uppercase tracking-widest">Guides {guidePage}/{totalGuidePages}</span>
                    <button disabled={guidePage >= totalGuidePages} onClick={() => setGuidePage((p) => Math.min(totalGuidePages, p + 1))} className="px-2 hover:bg-[#C4E8FF]/20 border-l border-[#C4E8FF] disabled:opacity-30"><ChevronRight className="w-3 h-3 text-[#1D3663]" /></button>
                  </div>

                  <div className="h-6 w-px bg-[#C4E8FF] mx-1"></div>

                  <div className="flex items-center gap-2 bg-[#C4E8FF]/20 p-1 rounded-xl border border-[#C4E8FF] ml-2">
                    <ZoomIn className="w-4 h-4 text-[#1D3663]/65 ml-2" />
                    <div className="flex gap-1">
                      <button onClick={() => setZoomLevel(1)} className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-lg transition-all ${zoomLevel === 1 ? "bg-white text-[#1D3663] shadow-sm" : "text-[#1D3663]/65 hover:text-[#1D3663]"}`}>12 Months</button>
                      <button onClick={() => setZoomLevel(2)} className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-lg transition-all ${zoomLevel === 2 ? "bg-white text-[#1D3663] shadow-sm" : "text-[#1D3663]/65 hover:text-[#1D3663]"}`}>Quarterly</button>
                      <button onClick={() => setZoomLevel(3)} className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-lg transition-all ${zoomLevel === 3 ? "bg-white text-[#1D3663] shadow-sm" : "text-[#1D3663]/65 hover:text-[#1D3663]"}`}>Daily</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#1D3663]/65 uppercase tracking-widest mr-2"><Filter className="w-3 h-3" /> Filters:</div>
                <input type="text" placeholder="Guide Name..." value={filterGuide} onChange={(e) => { setFilterGuide(e.target.value); setGuidePage(1); }} className="bg-[#C4E8FF]/10 border border-[#C4E8FF] rounded-lg px-3 py-1.5 text-xs text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none w-32" />
                <input type="text" placeholder="Ref or Group..." value={filterSearch} onChange={(e) => { setFilterSearch(e.target.value); setGuidePage(1); }} className="bg-[#C4E8FF]/10 border border-[#C4E8FF] rounded-lg px-3 py-1.5 text-xs text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none w-32" />

                <input type="text" list="timeline-clients" placeholder="Client..." value={filterClient} onChange={(e) => { setFilterClient(e.target.value); setGuidePage(1); }} className="bg-[#C4E8FF]/10 border border-[#C4E8FF] rounded-lg px-3 py-1.5 text-xs text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none w-32" />
                <datalist id="timeline-clients">
                  {allClients.map(c => <option key={c} value={c} />)}
                </datalist>

                <select value={selectedCountryXid} onChange={(e) => { setSelectedCountryXid(e.target.value); setGuidePage(1); }} className="bg-[#C4E8FF]/10 border border-[#C4E8FF] rounded-lg px-3 py-1.5 text-xs text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none w-40">
                  <option value="">Select country...</option>
                  {countryOptions.map((country) => (
                    <option key={country.xid} value={country.xid}>{country.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1 ml-2">
                  <span className="text-[9px] font-bold text-[#1D3663]/65 uppercase">Travel From</span>
                  <input
                    type="date"
                    value={draftFilterDateFrom}
                    onChange={(e) => setDraftFilterDateFrom(e.target.value)}
                    onBlur={commitCalendarDateFrom}
                    onKeyDown={(event) => handleCalendarDateKeyDown(event, commitCalendarDateFrom)}
                    className="bg-[#C4E8FF]/10 border border-[#C4E8FF] rounded-lg px-2 py-1 text-xs text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none h-[30px]"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold text-[#1D3663]/65 uppercase">To</span>
                  <input
                    type="date"
                    value={draftFilterDateTo}
                    onChange={(e) => setDraftFilterDateTo(e.target.value)}
                    onBlur={commitCalendarDateTo}
                    onKeyDown={(event) => handleCalendarDateKeyDown(event, commitCalendarDateTo)}
                    className="bg-[#C4E8FF]/10 border border-[#C4E8FF] rounded-lg px-2 py-1 text-xs text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none h-[30px]"
                  />
                </div>

                <div className="flex items-center gap-2 bg-[#C4E8FF]/10 px-2 py-1.5 rounded-lg border border-[#C4E8FF] ml-2">
                  <label className="text-[10px] font-bold text-[#1D3663] flex items-center gap-1 cursor-pointer"><input type="radio" name="timelineSeries" value="all" checked={filterSeries === 'all'} onChange={() => { setFilterSeries('all'); setGuidePage(1) }} /> All</label>
                  <label className="text-[10px] font-bold text-[#1D3663] flex items-center gap-1 cursor-pointer"><input type="radio" name="timelineSeries" value="series" checked={filterSeries === 'series'} onChange={() => { setFilterSeries('series'); setGuidePage(1) }} /> Series</label>
                  <label className="text-[10px] font-bold text-[#1D3663] flex items-center gap-1 cursor-pointer"><input type="radio" name="timelineSeries" value="noseries" checked={filterSeries === 'noseries'} onChange={() => { setFilterSeries('noseries'); setGuidePage(1) }} /> No Series</label>
                </div>

                {(selectedCountryXid || filterGuide || filterSearch || filterClient || filterDateFrom || filterDateTo || filterSeries !== "all") && (
                  <button onClick={() => {
                    const defaultCountry = countryOptions.find(
                      (country) => country.name.trim().toLowerCase() === DEFAULT_COUNTRY_NAME.toLowerCase(),
                    );
                    setFilterGuide("");
                    setFilterSearch("");
                    setFilterClient("");
                    setSelectedCountryXid(defaultCountry ? String(defaultCountry.xid) : "");
                    setFilterDateFrom(defaultMonthRange.from);
                    setFilterDateTo(defaultMonthRange.to);
                    setDraftFilterDateFrom(defaultMonthRange.from);
                    setDraftFilterDateTo(defaultMonthRange.to);
                    setFilterSeries("all");
                    setGuidePage(1);
                  }} className="text-[10px] font-bold text-[#F3796A] hover:underline uppercase ml-2">Clear Filters</button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto relative bg-[#C4E8FF]/10 pb-10" ref={timelineScrollRef}>
              {!selectedCountryXidNumber && (
                <div className="px-6 py-10 text-center text-[#1D3663]/55 font-bold">
                  Please select a country to load calendar data.
                </div>
              )}
              {selectedCountryXidNumber && (
              <div className="min-w-full inline-block bg-white border-b border-[#C4E8FF]">

                <div className="flex sticky top-0 z-[60] bg-white border-b border-[#C4E8FF] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
                  <div className="w-[260px] shrink-0 sticky left-0 z-[70] bg-white border-r border-[#C4E8FF] h-10 flex items-center px-6">
                    <span className="text-[11px] font-bold text-[#1D3663]/65 uppercase tracking-widest">Guide Directory</span>
                  </div>

                  <div className="flex relative" style={timelineTrackStyle}>
                    {!isDaily ? (
                      displayedMonthSegments.map((month) => {
                        const pct = (month.days / totalDaysInRange) * 100;
                        return (
                          <div key={month.key} style={{ width: `${pct}%` }} className="h-10 flex items-center justify-center border-r border-[#C4E8FF] bg-[#C4E8FF]/20">
                            <span className="text-xs font-bold text-[#1D3663]">{month.label}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col flex-1 min-w-max relative z-0">
                        <div className="absolute inset-0 pointer-events-none z-[60]">
                          <div className="sticky left-[260px] float-left top-0 bg-white border-r border-b border-[#C4E8FF] text-[#F3796A] px-2 py-0.5 rounded-br-md text-[8px] font-black uppercase tracking-widest shadow-sm transition-all duration-75 ease-out">
                            {visibleDateStart}
                          </div>
                          <div className="sticky right-0 float-right top-0 bg-white border-l border-b border-[#C4E8FF] text-[#F3796A] px-2 py-0.5 rounded-bl-md text-[8px] font-black uppercase tracking-widest shadow-sm transition-all duration-75 ease-out">
                            {visibleDateEnd}
                          </div>
                        </div>

                        <div className="flex h-5 border-b border-[#C4E8FF] relative z-10">
                          {displayedMonthSegments.map((month) => {
                            return (
                              <div key={month.key} style={{ width: `${month.days * currentCellWidth}px` }} className="flex items-center justify-center bg-[#C4E8FF]/20 border-r border-[#C4E8FF] shrink-0">
                                <span className="text-[10px] font-bold text-[#1D3663] uppercase tracking-widest">{month.label}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex h-5 relative z-10">
                          {displayedDays.map((date, i) => {
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            return (
                              <div key={i} style={{ width: `${currentCellWidth}px` }} className={`flex items-center justify-center border-r border-[#C4E8FF] shrink-0 ${isWeekend ? "bg-[#C4E8FF]/35" : "bg-white"}`}>
                                <span className={`font-black ${zoomLevel === 3 ? 'text-[9px]' : 'text-[7px]'} ${isWeekend ? "text-[#F3796A]" : "text-[#1D3663]"}`}>
                                  {date.getDate()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {paginatedGuides.length === 0 ? (
                  <div className="py-10 text-center text-[#1D3663]/55 font-bold">No guides match the current filter criteria.</div>
                ) : paginatedGuides.map((guide: any) => {

                  const filteredTours = guide.tours.filter((t: any) => {
                    const matchSearch = filterSearch ? (t.ref.toLowerCase().includes(filterSearch.toLowerCase()) || t.groupName.toLowerCase().includes(filterSearch.toLowerCase())) : true;
                    const matchClient = filterClient ? t.client.toLowerCase().includes(filterClient.toLowerCase()) : true;

                    const sName = getBookingSeriesName(t);
                    const isSeriesTour = sName !== "NO SERIES";
                    const matchSeries = filterSeries === "series" ? isSeriesTour : filterSeries === "noseries" ? !isSeriesTour : true;

                    let matchDate = true;
                    if (filterDateFrom || filterDateTo) {
                      const tStart = new Date(`${t.startDay}T00:00:00`).getTime();
                      const tEnd = tStart + (t.duration - 1) * 86400000;
                      if (filterDateFrom && filterDateTo) {
                        const fStart = new Date(`${filterDateFrom}T00:00:00`).getTime();
                        const fEnd = new Date(`${filterDateTo}T00:00:00`).getTime();
                        matchDate = tStart <= fEnd && tEnd >= fStart;
                      } else if (filterDateFrom) { matchDate = tEnd >= new Date(`${filterDateFrom}T00:00:00`).getTime(); }
                      else if (filterDateTo) { matchDate = tStart <= new Date(`${filterDateTo}T00:00:00`).getTime(); }
                    }
                    return matchSearch && matchClient && matchDate && matchSeries;
                  });

                  const events: any[] = [];

                  filteredTours.forEach((t: any) => {
                    let hasAnyAssignmentForBooking = false;
                    let hasDetailedAssignmentsForThisGuide = false;
                    let assignedDays = new Set<number>();

                    Object.entries(itemAssignments).forEach(([itemId, gId]) => {
                      if (itemId.startsWith(`${t.id}-`)) {
                        hasAnyAssignmentForBooking = true;
                        if (gId === guide.id) {
                          hasDetailedAssignmentsForThisGuide = true;
                          const match = itemId.match(/-d(\d+)-/);
                          if (match) assignedDays.add(parseInt(match[1], 10));
                        }
                      }
                    });

                    if (hasAnyAssignmentForBooking) {
                      if (hasDetailedAssignmentsForThisGuide && assignedDays.size > 0) {
                        const sortedDays = Array.from(assignedDays).sort((a, b) => a - b);
                        let blockStart = sortedDays[0];
                        let blockEnd = sortedDays[0];

                        const pushBlock = (sDay: number, eDay: number) => {
                          const d = new Date(`${t.startDay}T00:00:00`);
                          d.setDate(d.getDate() + (sDay - 1));
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          const startStr = `${y}-${m}-${day}`;

                          events.push({
                            type: "tour", start: startStr, duration: (eDay - sDay + 1), data: t,
                            guideStatus: isGuideConfirmed(t, guide.name) ? "confirmed" : "requested",
                            isCancelled: t.status?.toLowerCase() === "cancelled"
                          });
                        };

                        for (let i = 1; i < sortedDays.length; i++) {
                          if (sortedDays[i] === blockEnd + 1) {
                            blockEnd = sortedDays[i];
                          } else {
                            pushBlock(blockStart, blockEnd);
                            blockStart = sortedDays[i];
                            blockEnd = sortedDays[i];
                          }
                        }
                        pushBlock(blockStart, blockEnd);
                      }
                    } else {
                      events.push({
                        type: "tour", start: t.startDay, duration: t.duration, data: t,
                        guideStatus: isGuideConfirmed(t, guide.name) ? "confirmed" : "requested",
                        isCancelled: t.status?.toLowerCase() === "cancelled"
                      });
                    }
                  });

                  guide.busyDates.forEach((b: any) => {
                    events.push({
                      type: "busy", start: b.from, end: b.to, data: b,
                      duration: Math.round((new Date(`${b.to}T00:00:00`).getTime() - new Date(`${b.from}T00:00:00`).getTime()) / 86400000) + 1
                    });
                  });

                  const eventsInPeriodArr = events.filter((e: any) => {
                    const eStart = new Date(`${e.start}T00:00:00`).getTime();
                    const eEnd = eStart + e.duration * 86400000;
                    return eStart < rangeEndExclusiveMs && eEnd > rangeStartMs;
                  });

                  const confirmedCount = eventsInPeriodArr.filter((e: any) => e.type === "tour" && !isCancelledEvent(e) && e.guideStatus === "confirmed").length;
                  const requestedCount = eventsInPeriodArr.filter((e: any) => e.type === "tour" && !isCancelledEvent(e) && e.guideStatus === "requested").length;
                  const cancelledCount = eventsInPeriodArr.filter((e: any) => e.type === "tour" && isCancelledEvent(e)).length;
                  const busyCount = eventsInPeriodArr.filter((e: any) => e.type === "busy").length;

                  return (
                    <div key={guide.id} className="flex h-10 border-b border-[#C4E8FF]/60 group relative hover:bg-[#ebf6ff] z-0">
                      <div className="w-[260px] shrink-0 sticky left-0 z-[50] bg-white group-hover:bg-[#ebf6ff] border-r border-[#C4E8FF] flex items-center justify-between px-4 py-1 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.02)] h-10">
                        <div
                          onDoubleClick={() => { setGuideDetailsModalId(guide.id); setDetailsModalYear(new Date().getFullYear()); setGuideOverviewFilter('total'); }}
                          className="flex flex-col w-[110px] cursor-pointer group/name p-1 rounded-lg hover:bg-[#C4E8FF]/35 transition-colors"
                          title="Double-click to manage details & busy dates"
                        >
                          <span className="text-xs font-bold text-[#1D3663] truncate w-full group-hover/name:text-[#F3796A]">{guide.name}</span>
                          <span className="text-[9px] font-bold text-[#1D3663]/55 uppercase mt-0.5 truncate">{guide.tags.join(" • ")}</span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 overflow-hidden pr-2">
                          {confirmedCount > 0 && <span className="text-[10px] font-bold text-[#1D3663] whitespace-nowrap">{confirmedCount} Acpt</span>}
                          {requestedCount > 0 && <span className="text-[10px] font-bold text-[#F3796A] whitespace-nowrap">{requestedCount} Wait</span>}
                          {cancelledCount > 0 && <span className="text-[10px] font-bold text-[#1D3663]/45 whitespace-nowrap line-through">{cancelledCount} Canc</span>}
                          {busyCount > 0 && <span className="text-[10px] font-bold text-red-600 whitespace-nowrap">{busyCount} Busy</span>}
                        </div>
                      </div>

                      <div className="flex relative z-0" style={timelineTrackStyle}>
                        {!isDaily ? (
                          displayedMonthSegments.map((month) => {
                            const pct = (month.days / totalDaysInRange) * 100;
                            return <div key={month.key} style={{ width: `${pct}%` }} className="border-r border-[#C4E8FF]/60 pointer-events-none" />;
                          })
                        ) : (
                          displayedDays.map((date, i) => {
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            return <div key={i} style={{ width: `${currentCellWidth}px` }} className={`shrink-0 border-r border-[#C4E8FF]/60 pointer-events-none ${isWeekend ? "bg-[#C4E8FF]/15" : ""}`} />;
                          })
                        )}

                        {eventsInPeriodArr.map((event: any, eIdx: number) => {
                          const eStartMs = new Date(`${event.start}T00:00:00`).getTime();
                          const tStartMs = rangeStartMs;
                          const daysDiff = (eStartMs - tStartMs) / 86400000;
                          const leftStyle = `calc(${(daysDiff / totalDaysInRange) * 100}% + 2px)`;
                          const widthStyle = `calc(${(event.duration / totalDaysInRange) * 100}% - 4px)`;

                          const seriesName = event.type === "tour" ? getBookingSeriesName(event.data) : null;
                          const isDimmed = hoveredSeries && seriesName && hoveredSeries !== seriesName;

                          const getTooltip = () => {
                            if (event.type === "busy") return "Busy";
                            const { client, ref, status, country } = event.data;
                            return `${client} - ${ref} (${status})\nCountry: ${country || 'N/A'}`;
                          };

                          return (
                            <div
                              key={eIdx}
                              className={`absolute top-1/2 -translate-y-1/2 h-6 z-10 shadow-sm rounded-none overflow-hidden cursor-pointer transition-all duration-200 ${getEventBarClasses(event)} ${isDimmed ? 'opacity-20 grayscale' : 'hover:brightness-95 hover:shadow-md'}`}
                              style={{ left: leftStyle, width: widthStyle }}
                              title={getTooltip()}
                              onMouseEnter={() => { if (seriesName) setHoveredSeries(seriesName); }}
                              onMouseLeave={() => setHoveredSeries(null)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (event.type === "tour") {
                                  handleOpenBookingManager(event.data);
                                }
                              }}
                            >
                              {event.type === "tour" && !isCancelledEvent(event) && zoomLevel !== 1 && (
                                <div className="w-full h-full flex items-center px-1.5">
                                  <span className="text-[9px] font-black text-white uppercase tracking-widest truncate">{seriesName !== "NO SERIES" ? seriesName : event.data.groupName}</span>
                                </div>
                              )}
                              {isCancelledEvent(event) && (
                                <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden">
                                  <div className="w-full border-t-2 border-[#F3796A]"></div>
                                </div>
                              )}
                              {event.type === "busy" && zoomLevel !== 1 && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                                  <span className="text-[10px] font-black text-white/80 uppercase tracking-widest px-1">X</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        )}

        {/* --- BOOKINGS TAB --- */}
        {activeTab === 'bookings' && (
          <TimelineBookingsTab
            allClients={allClients}
            allCountries={allCountries}
            isLoading={isBookingsTableLoading}
            loadingSeries={loadingBookingSeries}
            loadingManageBookingId={loadingManageBookingId}
            modalSearchTerm={modalSearchTerm}
            modalFilterClient={modalFilterClient}
            modalFilterCountry={modalFilterCountry}
            modalFilterGuide={modalFilterGuide}
            modalFilterDateFrom={modalFilterDateFrom}
            modalFilterDateTo={modalFilterDateTo}
            modalFilterSeries={modalFilterSeries}
            groupedBySeries={groupedBySeries}
            bookingSeries={bookingSeries}
            expandedSeries={expandedSeries}
            getStatusBadge={getStatusBadge}
            onSearchTermChange={setModalSearchTerm}
            onFilterClientChange={setModalFilterClient}
            onFilterCountryChange={setModalFilterCountry}
            onFilterGuideChange={setModalFilterGuide}
            onFilterDateFromChange={setModalFilterDateFrom}
            onFilterDateToChange={setModalFilterDateTo}
            onFilterSeriesChange={setModalFilterSeries}
            onClearFilters={handleClearBookingFilters}
            onToggleSeriesAccordion={toggleSeriesAccordion}
            onToggleGuideConfirmation={handleRequestGuideStatusChange}
            onManageBooking={handleOpenBookingManager}
            onLoadMoreSeries={handleLoadMoreBookingSeries}
          />
        )}
      </main>

      {/* --- DUAL PANE MODAL: Guide Details & Busy Dates (Full Screen) --- */}
      {guideDetailsModalId && detailsGuide && (() => {
        // Calculate stats dynamically based on the selected detailsModalYear
        const toursInYear = detailsGuide.tours.filter((t: any) => t.startDay.startsWith(detailsModalYear.toString()));
        const todayMs = new Date().getTime();

        let finishedCount = 0;
        let incomingCount = 0;

        toursInYear.forEach((t: any) => {
          if (t.status?.toLowerCase() === 'cancelled') return;
          const endMs = new Date(`${t.startDay}T00:00:00`).getTime() + (t.duration - 1) * 86400000;
          if (endMs < todayMs) {
            finishedCount++;
          } else {
            incomingCount++;
          }
        });

        // Filtered view based on the current guideOverviewFilter state
        const displayedToursInYear = toursInYear.filter((t: any) => {
          if (t.status?.toLowerCase() === 'cancelled') return true;
          const endMs = new Date(`${t.startDay}T00:00:00`).getTime() + (t.duration - 1) * 86400000;
          if (guideOverviewFilter === 'finished') return endMs < todayMs;
          if (guideOverviewFilter === 'incoming') return endMs >= todayMs;
          return true;
        });

        const busyDatesInYear = detailsGuide.busyDates.filter((b: any) => b.from.startsWith(detailsModalYear.toString()) || b.to.startsWith(detailsModalYear.toString()));

        return (
          <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-in fade-in">

            {/* Header */}
            <div className="p-6 border-b border-[#C4E8FF] flex justify-between items-center bg-white shrink-0 shadow-sm relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#C4E8FF]/40 flex items-center justify-center border border-[#C4E8FF]">
                  <UserCheck className="w-6 h-6 text-[#1D3663]" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#1D3663] uppercase tracking-tight">{detailsGuide.name}</h3>
                  <div className="text-[10px] font-bold text-[#1D3663]/55 uppercase tracking-widest mt-0.5">{detailsGuide.tags.join(" • ")}</div>
                </div>
              </div>

              {/* Unified Year Selector */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4">
                <div className="flex border border-[#C4E8FF] rounded-xl overflow-hidden shadow-sm bg-white">
                  <button onClick={() => setDetailsModalYear(prev => prev - 1)} className="p-2 hover:bg-[#C4E8FF]/20 border-r border-[#C4E8FF] transition-colors"><ChevronLeft className="w-4 h-4 text-[#1D3663]" /></button>
                  <div className="px-6 py-2 bg-[#C4E8FF]/10 text-sm font-black text-[#1D3663] flex items-center justify-center w-24">{detailsModalYear}</div>
                  <button onClick={() => setDetailsModalYear(prev => prev + 1)} className="p-2 hover:bg-[#C4E8FF]/20 border-l border-[#C4E8FF] transition-colors"><ChevronRight className="w-4 h-4 text-[#1D3663]" /></button>
                </div>
              </div>

              <button onClick={() => setGuideDetailsModalId(null)} className="p-2.5 hover:bg-[#C4E8FF]/30 rounded-full transition-colors text-[#1D3663]/55 hover:text-[#1D3663]">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Dual Pane Body */}
            <div className="flex-1 flex min-h-0 bg-[#C4E8FF]/5">

              {/* LEFT PANE: Annual Booking Overview */}
              <div className="w-[35%] flex flex-col border-r border-[#C4E8FF] bg-white">
                {/* Enforced equal header heights */}
                <div className="p-6 shrink-0 border-b border-[#C4E8FF]/50 bg-gray-50/50 h-[176px] flex flex-col justify-between">
                  <h4 className="text-sm font-black text-[#1D3663] uppercase tracking-wide flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#F3796A]" /> Annual Booking Overview</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div onClick={() => setGuideOverviewFilter('total')} className={`bg-white p-4 rounded-2xl border cursor-pointer hover:bg-gray-50 transition-all ${guideOverviewFilter === 'total' ? 'border-[#1D3663] ring-1 ring-[#1D3663]' : 'border-[#C4E8FF] shadow-sm'} flex flex-col items-center justify-center text-center`}>
                      <span className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">Total Bookings</span>
                      <span className="text-2xl font-black text-[#1D3663] mt-1">{toursInYear.length}</span>
                    </div>
                    <div onClick={() => setGuideOverviewFilter('finished')} className={`bg-white p-4 rounded-2xl border cursor-pointer hover:bg-emerald-50/50 transition-all ${guideOverviewFilter === 'finished' ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-[#C4E8FF] shadow-sm'} flex flex-col items-center justify-center text-center`}>
                      <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest flex items-center gap-1"><History className="w-3 h-3" /> Finished</span>
                      <span className="text-2xl font-black text-emerald-600 mt-1">{finishedCount}</span>
                    </div>
                    <div onClick={() => setGuideOverviewFilter('incoming')} className={`bg-white p-4 rounded-2xl border cursor-pointer hover:bg-[#F3796A]/5 transition-all ${guideOverviewFilter === 'incoming' ? 'border-[#F3796A] ring-1 ring-[#F3796A]' : 'border-[#C4E8FF] shadow-sm'} flex flex-col items-center justify-center text-center`}>
                      <span className="text-[9px] font-black text-[#F3796A] uppercase tracking-widest flex items-center gap-1"><PlaneLanding className="w-3 h-3" /> Incoming</span>
                      <span className="text-2xl font-black text-[#F3796A] mt-1">{incomingCount}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 px-6 space-y-2.5">
                  {displayedToursInYear.length === 0 ? (
                    <div className="text-center py-10 text-[#1D3663]/45 font-bold italic text-sm">No bookings found for the selected view.</div>
                  ) : (
                    displayedToursInYear.sort((a: any, b: any) => new Date(a.startDay).getTime() - new Date(b.startDay).getTime()).map((t: any) => {
                      const endObj = new Date(new Date(t.startDay).getTime() + (t.duration - 1) * 86400000);
                      const endStr = endObj.toISOString().split('T')[0];
                      const isCancelled = t.status?.toLowerCase() === 'cancelled';

                      return (
                        <div key={t.id} className={`px-4 py-3 rounded-xl border ${isCancelled ? 'border-[#C4E8FF]/50 bg-gray-50 opacity-60' : 'border-[#C4E8FF] bg-white shadow-sm'} transition-all flex items-center justify-between gap-3`}>
                          <div className="flex flex-col min-w-0">
                            <div className={`text-xs font-black truncate leading-tight ${isCancelled ? 'text-[#1D3663]/60 line-through' : 'text-[#1D3663]'}`} title={t.ref}>{t.ref}</div>
                            <div className="text-[10px] font-bold text-[#1D3663]/65 mt-0.5 truncate">{t.groupName} • {t.startDay} → {endStr}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-[75px]">
                            <div className="flex justify-end w-full">
                              {getStatusBadge(t.status)}
                            </div>
                            {!isCancelled && (
                              <div
                                className={`text-[9px] font-black uppercase tracking-widest ${isGuideConfirmed(t, detailsGuide.name) ? "text-[#1D3663]" : "text-[#F3796A]"
                                  }`}
                              >
                                {isGuideConfirmed(t, detailsGuide.name) ? "Confirm" : "Waiting"}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setGuideDetailsModalId(null);
                                handleOpenBookingManager(t);
                              }}
                              className="bg-[#1D3663] text-white w-full py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest hover:brightness-95 transition-all shadow-sm flex items-center justify-center leading-none mt-1"
                            >
                              Manage
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT PANE: Busy Dates Management */}
              <div className="w-[65%] flex flex-col bg-gray-50/50">
                {/* Enforced equal header heights */}
                <div className="p-6 shrink-0 border-b border-[#C4E8FF]/50 bg-white h-[176px] flex flex-col justify-between">
                  <h4 className="text-sm font-black text-[#1D3663] uppercase tracking-wide flex items-center gap-2"><Calendar className="w-4 h-4 text-red-500" /> Busy Dates Management</h4>
                  <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4">
                    <label className="text-[9px] font-black text-red-800/60 uppercase tracking-widest mb-2 block">Add New Busy Period</label>
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-bold text-[#1D3663]/70">From</span>
                        <input type="date" value={newBusyFrom} onChange={(e) => setNewBusyFrom(e.target.value)} className="w-full text-xs bg-white border border-[#C4E8FF] rounded-xl p-2.5 text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-bold text-[#1D3663]/70">To</span>
                        <input type="date" value={newBusyTo} onChange={(e) => setNewBusyTo(e.target.value)} className="w-full text-xs bg-white border border-[#C4E8FF] rounded-xl p-2.5 text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none" />
                      </div>
                      <div className="w-32 space-y-1">
                        <span className="text-[10px] font-bold text-[#1D3663]/70">Shift</span>
                        <select
                          value={newBusyShiftCode}
                          onChange={(e) => setNewBusyShiftCode(e.target.value as ShiftCode)}
                          className="w-full text-xs bg-white border border-[#C4E8FF] rounded-xl p-2.5 text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none"
                        >
                          {SHIFT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button onClick={handleAddBusyDate} className="bg-[#1D3663] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md hover:brightness-95 transition-all h-[38px]">
                        Add Block
                      </button>
                    </div>
                  </div>
                </div>

                {/* MOVED HEADER: Pulled outside of the scrollable section to prevent any scrolling overlapping issues */}
                <div className="flex items-center justify-between bg-gray-100/80 px-6 py-2.5 border-b border-gray-200 shrink-0">
                  <label className="text-[10px] font-black text-[#1D3663]/55 uppercase tracking-widest">Blocks recorded in {detailsModalYear}</label>
                  <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">{busyDatesInYear.length} Blocks</span>
                </div>

                <div className="flex-1 overflow-auto p-6 pt-4 space-y-3">
                  {busyDatesInYear.length === 0 ? (
                    <div className="text-center py-10 text-[#1D3663]/45 font-bold italic text-sm">No busy dates recorded for this year.</div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-10">
                      {busyDatesInYear.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between bg-red-50/80 px-4 py-3 rounded-2xl border border-red-200 shadow-sm hover:shadow transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                            <span className="text-xs font-black text-red-700">
                              {b.from} <span className="text-red-400 mx-1">→</span> {b.to}
                            </span>
                          </div>
                          <button onClick={() => handleRemoveBusyDate(b.id, detailsGuide.id)} className="text-red-500 hover:bg-red-200 p-2 rounded-xl transition-colors" title="Remove block">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* --- Delete Busy Confirmation --- */}
      {pendingDeleteBusyId && (
        <div className="absolute inset-0 z-[130] bg-[#1D3663]/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center flex flex-col gap-6 animate-in zoom-in border border-[#C4E8FF]">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h4 className="text-base font-black text-[#1D3663]">Confirm deletion</h4>
              <p className="text-sm text-[#1D3663]/65 mt-2 font-medium">Are you sure you want to delete this busy date block?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setPendingDeleteBusyId(null); setPendingDeleteBusyGuideId(null); }} className="flex-1 py-3 bg-white hover:bg-[#C4E8FF]/20 text-[#1D3663] font-bold rounded-xl transition-colors border border-[#C4E8FF]">Cancel</button>
              <button onClick={async () => {
                if (pendingDeleteBusyGuideId && pendingDeleteBusyId) {
                  const nextTimelineData = await runTimelineApi("Removing busy date...", () =>
                    mockApi.removeGuideBusyDate(pendingDeleteBusyGuideId, pendingDeleteBusyId),
                  );
                  applyTimelineData(nextTimelineData);
                }
                setPendingDeleteBusyId(null); setPendingDeleteBusyGuideId(null);
              }} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {pendingGuideStatusChange && (
        <div className="absolute inset-0 z-[131] bg-[#1D3663]/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center flex flex-col gap-6 animate-in zoom-in border border-[#C4E8FF]">
            <div className="mx-auto w-12 h-12 bg-[#C4E8FF]/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[#F3796A]" />
            </div>
            <div>
              <h4 className="text-base font-black text-[#1D3663]">Confirm guide status</h4>
              <p className="text-sm text-[#1D3663]/65 mt-2 font-medium">
                Confirm <strong>{pendingGuideStatusChange.guideName}</strong> for all selected services in this booking?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingGuideStatusChange(null)}
                className="flex-1 py-3 bg-white hover:bg-[#C4E8FF]/20 text-[#1D3663] font-bold rounded-xl transition-colors border border-[#C4E8FF]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGuideStatusChange}
                className="flex-1 py-3 bg-[#F3796A] hover:brightness-95 text-white font-black rounded-xl transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {guideTimingModalState && (
        <div className="absolute inset-0 z-[132] bg-[#1D3663]/35 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden border border-[#C4E8FF]">
            <div className="px-6 py-4 border-b border-[#C4E8FF] flex items-center justify-between bg-white">
              <div>
                <h3 className="text-base font-black text-[#1D3663] uppercase tracking-tight">{guideTimingModalState.title}</h3>
                <p className="text-[9px] font-bold text-[#1D3663]/55 uppercase tracking-widest mt-1">
                  {guideTimingModalState.guideName} • {guideTimingModalState.bookingId}
                </p>
              </div>
              <button
                onClick={handleCloseGuideTimingModal}
                className="p-2 hover:bg-[#C4E8FF]/25 rounded-full transition-colors text-[#1D3663]/55"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-auto bg-[#C4E8FF]/10">
              <div className="rounded-2xl border border-[#C4E8FF] bg-white px-4 py-3 text-sm font-medium text-[#1D3663]/75">
                {guideTimingModalState.description}
              </div>
              {guideTimingModalState.drafts.map((draft) => (
                <div key={draft.date} className="rounded-2xl border border-[#C4E8FF] bg-white p-4">
                  <div className="flex items-center gap-2 text-[#1D3663] font-black text-sm">
                    <Clock3 className="w-4 h-4 text-[#F3796A]" />
                    {draft.date}
                  </div>
                  <div className="mt-4">
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/55">Shift</span>
                      <select
                        value={draft.shift}
                        onChange={(event) => handleGuideTimingDraftChange(draft.date, event.target.value as ShiftCode)}
                        className="w-full rounded-xl border border-[#C4E8FF] px-3 py-2 text-sm font-bold text-[#1D3663] outline-none focus:ring-2 focus:ring-[#F3796A]"
                      >
                        {SHIFT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value} • {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#C4E8FF] bg-white flex gap-3">
              <button
                onClick={handleCloseGuideTimingModal}
                className="flex-1 py-3 bg-white hover:bg-[#C4E8FF]/20 text-[#1D3663] font-bold rounded-xl transition-colors border border-[#C4E8FF]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGuideTiming}
                className="flex-1 py-3 bg-[#1D3663] hover:brightness-95 text-white font-black rounded-xl transition-colors"
              >
                {guideTimingModalState.submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailComposerState && (
        <div className="absolute inset-0 z-[133] bg-[#1D3663]/35 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden border border-[#C4E8FF]">
            <div className="px-6 py-4 border-b border-[#C4E8FF] flex items-center justify-between bg-white">
              <div>
                <h3 className="text-base font-black text-[#1D3663] uppercase tracking-tight">Email Template</h3>
                <p className="text-[9px] font-bold text-[#1D3663]/55 uppercase tracking-widest mt-1">
                  {emailComposerState.bookingRef} • {emailComposerState.guideName}
                </p>
              </div>
              <button
                onClick={() => setEmailComposerState(null)}
                className="p-2 hover:bg-[#C4E8FF]/25 rounded-full transition-colors text-[#1D3663]/55"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/55 md:pt-3">
                  Record Date
                </label>
                <input
                  type="date"
                  value={emailComposerState.date}
                  onChange={(event) =>
                    setEmailComposerState((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                  }
                  className="w-full border border-[#C4E8FF] rounded-xl px-4 py-2.5 text-sm font-medium text-[#1D3663] outline-none focus:ring-1 focus:ring-[#F3796A]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/55 md:pt-3">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailComposerState.subject}
                  onChange={(event) =>
                    setEmailComposerState((prev) => (prev ? { ...prev, subject: event.target.value } : prev))
                  }
                  className="w-full border border-[#C4E8FF] rounded-xl px-4 py-2.5 text-sm font-medium text-[#1D3663] outline-none focus:ring-1 focus:ring-[#F3796A]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/55 md:pt-3">
                  Template
                </label>
                <textarea
                  rows={12}
                  value={emailComposerState.body}
                  onChange={(event) =>
                    setEmailComposerState((prev) => (prev ? { ...prev, body: event.target.value } : prev))
                  }
                  className="w-full border border-[#C4E8FF] rounded-2xl px-4 py-3 text-sm font-medium text-[#1D3663] outline-none focus:ring-1 focus:ring-[#F3796A]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#C4E8FF] flex items-center justify-between gap-3 bg-white">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/50">
                {emailComposerState.actionLabel
                  ? `Last action: ${emailComposerState.actionLabel}`
                  : "No email action recorded yet"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEmailComposerState(null)}
                  className="px-4 py-2 bg-white border border-[#C4E8FF] text-[#1D3663] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#C4E8FF]/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveEmailRecord("draft")}
                  className="px-4 py-2 bg-[#C4E8FF]/20 border border-[#C4E8FF] text-[#1D3663] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#C4E8FF]/35 transition-all"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSaveEmailRecord("sent")}
                  className="px-4 py-2 bg-[#1D3663] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-95 transition-all"
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN FULL-SCREEN ASSIGN MODAL (Item Selection Board) --- */}
      {activeAssignmentBooking && (
        <TimelineBookingAssignmentModal
          activeAssignmentBooking={activeAssignmentBooking}
          guidesData={guidesData}
          emailRecords={emailRecords}
          dailyColumns={dailyColumns}
          selectedItemsToAssign={selectedItemsToAssign}
          showGuideSelector={showGuideSelector}
          guideSearchTerm={guideSearchTerm}
          filteredGuidesForModal={filteredGuidesForModal}
          selectedGuideId={selectedGuideId}
          selectedGuideShiftCode={selectedGuideShiftCode}
          availabilityLoading={availabilityLoading}
          availabilityError={availabilityError}
          showUnassignDialog={showUnassignDialog}
          pendingUnassignGuide={pendingUnassignGuide}
          canUnassignSelectedItems={
            selectedAssignedGuideNames.hasOnlyAssignedItems && selectedAssignedGuideNames.guideNames.length === 1
          }
          selectedAssignedGuideLabel={
            selectedAssignedGuideNames.guideNames.length === 1
              ? selectedAssignedGuideNames.guideNames[0]
              : selectedAssignedGuideNames.guideNames.length > 1
                ? "Mixed guides"
                : null
          }
          getGuideAvailability={getGuideAvailability}
          onBack={handleCloseBookingManager}
          onCloseBoard={handleDismissBookingManager}
          onSelectAll={handleSelectAll}
          onToggleGuideConfirmation={(guideName, isConfirmed) =>
            handleRequestGuideStatusChange(activeAssignmentBooking.id, guideName, isConfirmed)
          }
          onStartUnassign={handleStartUnassignGuide}
          onUnassignSelectedItems={handleUnassignSelectedItems}
          onOpenEmailComposer={handleOpenEmailComposer}
          onOpenGuideTimingEditor={openGuideTimingEditor}
          onSelectDay={handleSelectDay}
          onItemMouseDown={handleItemMouseDown}
          onItemMouseEnter={handleItemMouseEnter}
          onItemTimeSlotChange={handleItemTimeSlotChange}
          onOpenGuideSelector={() => {
            setSelectedGuideId(null);
            setSelectedGuideShiftCode(null);
            setShowGuideSelector(true);
          }}
          onCloseGuideSelector={() => {
            setShowGuideSelector(false);
            setSelectedGuideId(null);
            setSelectedGuideShiftCode(null);
          }}
          onGuideSearchTermChange={setGuideSearchTerm}
          onSelectGuide={handleSelectGuide}
          onSelectGuideShift={handleSelectGuideShift}
          onConfirmAssignment={handleConfirmAssignment}
          onClearSelectedItems={handleClearSelectedItems}
          onCancelUnassign={handleCancelUnassignGuide}
          onConfirmUnassign={handleConfirmUnassignGuide}
        />
      )}

    </div>
  );
}

