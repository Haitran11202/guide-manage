import { useMemo, useState } from "react";
import { AlertCircle, CheckSquare, ChevronLeft, Clock3, FileText, Mail, Search, UserCheck, X } from "lucide-react";
import { buildGuideEmailKey } from "../../mock/api";
import type { GuideEmailRecord, ServiceDayPart, ShiftCode } from "../../mock/types";

type DailyColumnItem = {
  id: string;
  type: string;
  assignedGuideName: string | null;
  slot: ServiceDayPart;
};

type DailyColumn = {
  dayNum: number;
  dateStr: string;
  items: DailyColumnItem[];
};

type GuideAvailability = {
  label: string;
  color: string;
  selectable: boolean;
  requiresTimeInput?: boolean;
  requiresShiftSelection: boolean;
  availableShiftCodes: ShiftCode[];
  busyShiftCodes: ShiftCode[];
};

const SHIFT_TAGS: Array<{ value: ShiftCode; label: string }> = [
  { value: "M1", label: "M1" },
  { value: "M2", label: "M2" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "E1", label: "E1" },
  { value: "E2", label: "E2" },
  { value: "N1", label: "N1" },
  { value: "N2", label: "N2" },
];

type TimelineBookingAssignmentModalProps = {
  activeAssignmentBooking: any | null;
  guidesData: any[];
  emailRecords: Record<string, GuideEmailRecord>;
  dailyColumns: DailyColumn[];
  selectedItemsToAssign: Set<string>;
  showGuideSelector: boolean;
  guideSearchTerm: string;
  filteredGuidesForModal: any[];
  selectedGuideId: number | null;
  selectedGuideShiftCode: ShiftCode | null;
  availabilityLoading: boolean;
  availabilityError: string | null;
  showUnassignDialog: boolean;
  pendingUnassignGuide: string | null;
  canUnassignSelectedItems: boolean;
  selectedAssignedGuideLabel: string | null;
  getGuideAvailability: (guide: any) => GuideAvailability;
  onBack: () => void;
  onCloseBoard: () => void;
  onSelectAll: () => void;
  onToggleGuideConfirmation: (guideName: string, isConfirmed: boolean) => void;
  onStartUnassign: (guideName: string) => void;
  onUnassignSelectedItems: () => void;
  onOpenEmailComposer: (guideId: number, guideName: string) => void;
  onOpenGuideTimingEditor: (guideId: number, guideName: string) => void;
  onSelectDay: (dayNum: number) => void;
  onItemMouseDown: (itemId: string) => void;
  onItemMouseEnter: (itemId: string) => void;
  onItemTimeSlotChange: (itemId: string, slot: ServiceDayPart) => void;
  onOpenGuideSelector: () => void;
  onCloseGuideSelector: () => void;
  onGuideSearchTermChange: (value: string) => void;
  onSelectGuide: (guideId: number) => void;
  onSelectGuideShift: (guideId: number, shiftCode: ShiftCode) => void;
  onConfirmAssignment: () => void;
  onClearSelectedItems: () => void;
  onCancelUnassign: () => void;
  onConfirmUnassign: () => void;
};

const formatServiceName = (value: string) => {
  const withoutPrefix = value.includes("\\") ? value.split("\\").pop() ?? value : value;
  return withoutPrefix.replace(" for Guide", "").trim();
};

const getEmailStatusLabel = (record: GuideEmailRecord | null) => {
  if (!record) return "No sent date recorded";
  return `${record.status === "draft" ? "Draft saved" : "Sent"}: ${record.date}`;
};

const documentButtons = [
  { id: "op-itinerary", label: "Op. Itinerary" },
  { id: "adv-cash", label: "Adv. Cash" },
  { id: "settlement", label: "Settlement" },
] as const;

export function TimelineBookingAssignmentModal({
  activeAssignmentBooking,
  guidesData,
  emailRecords,
  dailyColumns,
  selectedItemsToAssign,
  showGuideSelector,
  guideSearchTerm,
  filteredGuidesForModal,
  selectedGuideId,
  selectedGuideShiftCode,
  availabilityLoading,
  availabilityError,
  showUnassignDialog,
  pendingUnassignGuide,
  canUnassignSelectedItems,
  selectedAssignedGuideLabel,
  getGuideAvailability,
  onBack,
  onCloseBoard,
  onSelectAll,
  onToggleGuideConfirmation,
  onStartUnassign,
  onUnassignSelectedItems,
  onOpenEmailComposer,
  onOpenGuideTimingEditor,
  onSelectDay,
  onItemMouseDown,
  onItemMouseEnter,
  onItemTimeSlotChange,
  onOpenGuideSelector,
  onCloseGuideSelector,
  onGuideSearchTermChange,
  onSelectGuide,
  onSelectGuideShift,
  onConfirmAssignment,
  onClearSelectedItems,
  onCancelUnassign,
  onConfirmUnassign,
}: TimelineBookingAssignmentModalProps) {
  const [downloadingDocument, setDownloadingDocument] = useState<string | null>(null);

  const downloadDocument = async (documentButtonId: (typeof documentButtons)[number]["id"]) => {
    const resNo = activeAssignmentBooking?.ref;
    if (!resNo || downloadingDocument) return;

    const downloadKey = documentButtonId;
    setDownloadingDocument(downloadKey);

    try {
      const BASE_URL = "https://localhost:7100/api/v1";
      let url: string;
      let body: object;

      if (documentButtonId === "op-itinerary") {
        url = `${BASE_URL}/document/booking/operation-itinerary/download`;
        body = { resNo, userId: 2134, clientXid: 45108, draftEmail: true };
      } else if (documentButtonId === "adv-cash") {
        url = `${BASE_URL}/document/booking/advancash-guide/download`;
        body = { userEmail: "", draftEmail: true, resNo, userId: 2134 };
      } else {
        url = `${BASE_URL}/document/booking/guide-salary/download`;
        body = { userEmail: "", draftEmail: true, resNo, userId: 2134 };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "*/*" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]*)\1/);
      const filename = filenameMatch?.[2]?.trim() || `${documentButtonId}-${resNo}.pdf`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("[DocumentDownload] Failed:", error);
    } finally {
      setDownloadingDocument(null);
    }
  };

  const dayCards = useMemo(
    () =>
      dailyColumns.map((day) => {
        const guideGroups = new Map<string, DailyColumnItem[]>();

        day.items.forEach((item) => {
          const guideName = item.assignedGuideName || "Unassigned";
          guideGroups.set(guideName, [...(guideGroups.get(guideName) ?? []), item]);
        });

        return {
          ...day,
          guideGroups: Array.from(guideGroups.entries()).map(([guideName, items]) => ({
            guideName,
            items,
          })),
        };
      }),
    [dailyColumns],
  );
  const guideExceptionLabels = useMemo(() => {
    if (!activeAssignmentBooking) return new Map<string, string>();

    const next = new Map<string, string>();

    guidesData.forEach((guide) => {
      (guide.timeExceptions ?? [])
        .filter((exception: any) => exception.bookingId === activeAssignmentBooking.id)
        .forEach((exception: any) => {
          const key = `${guide.name}-${exception.date}`;
          next.set(key, `${String(exception.startHour).padStart(2, "0")}:00 - ${String(exception.endHour).padStart(2, "0")}:00`);
        });
    });

    return next;
  }, [activeAssignmentBooking, guidesData]);

  if (!activeAssignmentBooking) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#1D3663]/28 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onCloseBoard}
    >
      <div
        className="w-full max-w-[96rem] h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] bg-white rounded-[32px] border border-[#C4E8FF] shadow-[0_28px_80px_rgba(29,54,99,0.22)] flex flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pl-6 pr-3 py-3 border-b border-[#C4E8FF] flex items-center justify-between bg-white shrink-0 shadow-sm relative z-20">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[#333] font-bold hover:bg-[#C4E8FF]/25 px-3 py-1.5 rounded-xl border border-[#C4E8FF] transition-colors text-sm shrink-0"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="min-w-0 px-4 py-2 flex items-center gap-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-[#333]/55 shrink-0">Booking</div>
              <div className="text-xs font-black text-[#333] truncate shrink-0">{activeAssignmentBooking.ref}</div>
              <div className="text-[10px] font-bold text-[#333]/65 truncate min-w-0">
                {activeAssignmentBooking.groupName} / {activeAssignmentBooking.client}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="text-right border-r border-[#C4E8FF] pr-3 md:pr-4 flex flex-col justify-center">
              <div className="text-[9px] font-black text-[#333]/55 uppercase tracking-widest mb-0.5">
                Duration
              </div>
              <div className="text-base font-black text-[#F3796A] leading-none">
                {activeAssignmentBooking.duration} Days
              </div>
            </div>
            <button
              onClick={onSelectAll}
              className="bg-white hover:bg-[#C4E8FF]/20 text-[#333] px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 border border-[#C4E8FF]"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Select All Items
            </button>
            <button
              type="button"
              onClick={onCloseBoard}
              className="p-2 hover:bg-[#C4E8FF]/25 rounded-full transition-colors text-[#333]/55"
              aria-label="Close booking manager"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-[#C4E8FF]/10 relative">
          <div className="py-3 px-4 border-b border-[#C4E8FF] bg-white shrink-0 flex flex-col gap-3 shadow-sm relative z-10">
            <span className="text-[9px] font-black text-[#333]/55 uppercase tracking-widest">
              Currently Assigned
            </span>

            {activeAssignmentBooking.assignedGuides.length === 0 ? (
              <span className="text-xs font-medium text-[#333]/45 italic">None assigned yet.</span>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {activeAssignmentBooking.assignedGuides.map((guideName: string) => {
                  const guideAssignStatus = activeAssignmentBooking.guideStatuses?.[guideName] ?? 1;
                  const isConfirmed = guideAssignStatus === 2;
                  const guide = guidesData.find((item) => item.name === guideName);
                  const emailRecord = guide ? emailRecords[buildGuideEmailKey(activeAssignmentBooking.id, guide.id)] : null;

                  return (
                    <div
                      key={guideName}
                      className="flex min-h-[104px] flex-col gap-3 rounded-[24px] border border-[#C4E8FF] bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="block truncate text-sm font-black text-[#333]">{guideName}</span>
                              {guide && (
                                <button
                                  type="button"
                                  onClick={() => onOpenGuideTimingEditor(guide.id, guideName)}
                                  className="inline-flex items-center justify-center rounded-full border border-[#C4E8FF] bg-[#C4E8FF]/10 p-1 text-[#333] transition-colors hover:bg-[#C4E8FF]/35"
                                  title="Set timing exception"
                                >
                                  <Clock3 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {guide && (
                              <span className="mt-1 block text-[9px] font-bold uppercase tracking-widest text-[#333]/50">
                                {guide.tags.join(" / ")}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 border-l border-[#C4E8FF] pl-4">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!isConfirmed) {
                                  onToggleGuideConfirmation(guideName, isConfirmed);
                                }
                              }}
                              disabled={isConfirmed}
                              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#333] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <span
                                className={`rounded-full border px-3 py-1 ${isConfirmed
                                  ? "border-[#1D3663] bg-[#1D3663] text-white"
                                  : "border-[#F3796A]/30 bg-[#F3796A]/10 text-[#F3796A]"
                                  }`}
                              >
                                {isConfirmed ? "Confirmed" : "Confirm"}
                              </span>
                            </button>

                            <button
                              onClick={() => onStartUnassign(guideName)}
                              className="rounded-full border border-[#F3796A] bg-white px-3 py-1 text-[8px] font-black uppercase tracking-widest text-[#F3796A] transition-colors hover:bg-[#F3796A] hover:text-white"
                            >
                              Unassign
                            </button>
                          </div>
                        </div>

                        <div className="flex min-w-[320px] flex-1 items-center gap-2 self-stretch">
                          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
                            {documentButtons.map((documentButton) => {
                              return (
                                <div key={`${guideName}-${documentButton.id}`} className="flex min-w-0 flex-col items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={downloadingDocument === documentButton.id}
                                    onClick={() => downloadDocument(documentButton.id)}
                                    className="flex w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#C4E8FF] bg-[#C4E8FF]/10 px-2 py-2 text-[8px] font-black uppercase tracking-widest text-[#333] transition-colors hover:bg-[#C4E8FF]/40 disabled:opacity-60 disabled:cursor-wait"
                                  >
                                    {downloadingDocument === documentButton.id ? (
                                      <svg className="h-2.5 w-2.5 shrink-0 animate-spin text-[#F3796A]" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                      </svg>
                                    ) : (
                                      <FileText className="h-2.5 w-2.5 shrink-0 text-[#F3796A]" />
                                    )}
                                    <span>{downloadingDocument === documentButton.id ? "..." : documentButton.label}</span>
                                  </button>
                                  <span className="text-center text-[9px] font-bold text-[#333]/55 opacity-0">
                                    Downloading...
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="ml-auto flex min-w-[116px] flex-col items-center gap-1">
                          <button
                            onClick={() => guide && onOpenEmailComposer(guide.id, guideName)}
                            className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1D3663] px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white shadow-sm transition-all hover:brightness-95"
                          >
                            <Mail className="h-2.5 w-2.5 shrink-0" />
                            <span>Email</span>
                          </button>
                          <span className="text-center text-[9px] font-bold text-[#333]/55">
                            {getEmailStatusLabel(emailRecord)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="overflow-x-auto pb-24">
              <div className="grid min-w-[1320px] grid-cols-6 gap-3">
                {dayCards.map((day) => (
                  <div
                    key={`${activeAssignmentBooking.id}-${day.dayNum}`}
                    className="border border-[#C4E8FF] rounded-2xl bg-white min-w-[220px] shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-[#C4E8FF] flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-[#333]/55">
                          Day {day.dayNum}
                        </div>
                        <div className="text-md font-black text-[#333] leading-tight">{day.dateStr}</div>
                      </div>
                      <button
                        onClick={() => onSelectDay(day.dayNum)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#C4E8FF] text-[10px] font-black uppercase tracking-widest text-[#333] hover:bg-[#C4E8FF]/20"
                      >
                        Select
                      </button>
                    </div>

                    <div className="px-3 py-3 space-y-3">
                      {day.guideGroups.map((group, groupIndex) => (
                        <div key={`${day.dayNum}-${group.guideName}`} className="space-y-2">
                          {groupIndex > 0 && (
                            <div className="border-t border-dashed border-[#C4E8FF] pt-3" />
                          )}

                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={`text-sm font-black ${group.guideName === "Unassigned" ? "text-[#F3796A]" : "text-[#333]"
                                }`}
                            >
                              {group.guideName}
                            </div>
                            {group.guideName !== "Unassigned" &&
                              guideExceptionLabels.has(`${group.guideName}-${day.dateStr}`) && (
                                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black text-[#F3796A]">
                                  <Clock3 className="h-3 w-3" />
                                  <span>{guideExceptionLabels.get(`${group.guideName}-${day.dateStr}`)}</span>
                                </span>
                              )}
                          </div>

                          {group.items.map((item) => {
                            const isSelected = selectedItemsToAssign.has(item.id);

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={() => onItemMouseDown(item.id)}
                                onMouseEnter={() => onItemMouseEnter(item.id)}
                                className={`w-full cursor-pointer transition-all text-left px-1 py-1.5 rounded-lg ${isSelected
                                  ? "bg-[#F3796A]/10 text-[#F3796A]"
                                  : "bg-transparent text-[#333] hover:bg-[#C4E8FF]/15"
                                  }`}
                              >
                                <div className="text-sm">{item.type}</div>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedItemsToAssign.size > 0 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#1D3663] text-white px-4 py-3 rounded-[24px] shadow-[0_10px_30px_rgba(29,54,99,0.25)] flex items-center gap-3 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-white/65 uppercase tracking-widest leading-tight">
                    Ready to Assign
                  </span>
                  <span className="text-base font-black leading-tight">
                    {selectedItemsToAssign.size} Items Selected
                  </span>
                  {selectedAssignedGuideLabel && (
                    <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest leading-tight mt-1">
                      Current: {selectedAssignedGuideLabel}
                    </span>
                  )}
                </div>
                <button
                  onClick={onOpenGuideSelector}
                  className="bg-[#F3796A] hover:brightness-95 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" /> Assign Guide
                </button>
                {canUnassignSelectedItems && (
                  <button
                    onClick={onUnassignSelectedItems}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 active:scale-95"
                  >
                    Unassign
                  </button>
                )}
                <button
                  onClick={onClearSelectedItems}
                  className="w-9 h-9 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {showGuideSelector && (
            <div className="absolute inset-0 bg-[#1D3663]/20 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden border border-[#C4E8FF]">
                <div className="p-6 border-b border-[#C4E8FF] flex justify-between items-center bg-white shrink-0">
                  <div>
                    <h3 className="text-base font-black text-[#333] uppercase tracking-tight">Assign Guide</h3>
                    <p className="text-[9px] font-bold text-[#333]/55 uppercase tracking-widest mt-1">
                      Assigning {selectedItemsToAssign.size} services
                    </p>
                  </div>
                  <button
                    onClick={onCloseGuideSelector}
                    className="p-2 hover:bg-[#C4E8FF]/25 rounded-full transition-colors text-[#333]/55"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 border-b border-[#C4E8FF] bg-white shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#333]/45" />
                    <input
                      type="text"
                      value={guideSearchTerm}
                      onChange={(event) => onGuideSearchTermChange(event.target.value)}
                      placeholder="Search guides by name or tag..."
                      className="w-full bg-white border border-[#C4E8FF] rounded-xl pl-10 py-3 text-xs font-bold text-[#333] placeholder:text-[#333]/45 focus:ring-2 focus:ring-[#F3796A] outline-none"
                    />
                  </div>
                  <div className="mt-3 text-[10px] font-bold text-[#333]/55">
                    {availabilityLoading
                      ? "Checking guide availability for the selected services..."
                      : availabilityError || "Fully free guides use ALL by default. Guides that are partially busy require choosing one free shift below."}
                  </div>
                </div>
                <div className="p-4 overflow-auto flex-1 space-y-2 bg-[#C4E8FF]/10">
                  {filteredGuidesForModal.length === 0 ? (
                    <div className="text-center text-[#333]/55 py-10 font-bold">No guides found.</div>
                  ) : (
                    filteredGuidesForModal.map((guide: any) => {
                      const availability = getGuideAvailability(guide);

                      const isSelected = selectedGuideId === guide.id;
                      const showShiftTags = availability.requiresShiftSelection && availability.availableShiftCodes.length > 0;

                      return (
                        <div
                          key={guide.id}
                          onClick={() => !showShiftTags && availability.selectable && onSelectGuide(guide.id)}
                          className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-left ${isSelected
                            ? "border-[#F3796A] bg-[#F3796A]/5 shadow-sm"
                            : availability.selectable
                              ? "border-[#C4E8FF] hover:border-[#1D3663]/15 bg-white"
                              : "border-[#C4E8FF] bg-gray-100 opacity-70 cursor-not-allowed"
                            }`}
                        >
                          <div>
                            <div className="text-sm font-bold text-[#333]">{guide.name}</div>
                            <div className="text-[10px] font-bold text-[#333]/45 mt-0.5">
                              {guide.tags.join(" / ")}
                            </div>
                            {showShiftTags && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {SHIFT_TAGS.map((shiftTag) => {
                                  const isShiftAvailable = availability.availableShiftCodes.includes(shiftTag.value);
                                  const isShiftSelected =
                                    isSelected && selectedGuideShiftCode === shiftTag.value;

                                  return (
                                    <button
                                      key={`${guide.id}-${shiftTag.value}`}
                                      type="button"
                                      disabled={!isShiftAvailable}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (isShiftAvailable) {
                                          onSelectGuideShift(guide.id, shiftTag.value);
                                        }
                                      }}
                                      className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${isShiftSelected
                                          ? "border-[#F3796A] bg-[#F3796A] text-white"
                                          : isShiftAvailable
                                            ? "border-[#C4E8FF] bg-white text-[#333] hover:border-[#F3796A] hover:text-[#F3796A]"
                                            : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                                        }`}
                                    >
                                      {shiftTag.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${availability.color}`}>
                              {availability.label}
                            </span>
                            {availability.requiresTimeInput && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#C4E8FF] bg-[#C4E8FF]/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-[#333]">
                                <Clock3 className="h-3 w-3" />
                                Timing
                              </span>
                            )}
                            {isSelected && (
                              <span className="px-2 py-1 rounded-full bg-[#F3796A] text-white text-[8px] font-black uppercase tracking-widest">
                                {selectedGuideShiftCode ?? "Selected"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-5 border-t border-[#C4E8FF] bg-white shrink-0">
                  <button
                    disabled={!selectedGuideId || !selectedGuideShiftCode}
                    className="w-full bg-[#1D3663] text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-95 transition-all disabled:opacity-50 shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
                    onClick={onConfirmAssignment}
                  >
                    <CheckSquare className="w-4 h-4" /> Confirm Assignment
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUnassignDialog && pendingUnassignGuide && (
            <div className="absolute inset-0 z-[111] bg-[#1D3663]/30 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center flex flex-col gap-6 animate-in zoom-in-95 border border-[#C4E8FF]">
                <div className="mx-auto w-12 h-12 bg-[#C4E8FF]/40 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-[#F3796A]" />
                </div>
                <div>
                  <h4 className="text-base font-black text-[#333]">Confirm unassign</h4>
                  <p className="text-sm text-[#333]/65 mt-2 font-medium">
                    Do you want to unassign <strong>{pendingUnassignGuide}</strong> from this booking?
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={onCancelUnassign}
                    className="flex-1 py-3 bg-white hover:bg-[#C4E8FF]/20 text-[#333] font-bold rounded-xl transition-colors border border-[#C4E8FF]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirmUnassign}
                    className="flex-1 py-3 bg-[#F3796A] hover:brightness-95 text-white font-black rounded-xl transition-colors"
                  >
                    Unassign
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
