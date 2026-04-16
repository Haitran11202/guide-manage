import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { TimelineBooking } from "../../mock/types";

type SeriesFilter = "all" | "series" | "noseries";

type SeriesStats = {
  total: number;
  assigned: number;
  notAssigned: number;
  cancelled: number;
  onRequest: number;
  confirmed: number;
};

type TimelineBookingsTabProps = {
  allClients: string[];
  allCountries: string[];
  modalSearchTerm: string;
  modalFilterClient: string;
  modalFilterCountry: string;
  modalFilterGuide: string;
  modalFilterDateFrom: string;
  modalFilterDateTo: string;
  modalFilterSeries: SeriesFilter;
  groupedBySeries: Record<string, TimelineBooking[]>;
  expandedSeries: Set<string>;
  getSeriesStats: (bookings: TimelineBooking[]) => SeriesStats;
  getStatusBadge: (status: string) => ReactNode;
  onSearchTermChange: (value: string) => void;
  onFilterClientChange: (value: string) => void;
  onFilterCountryChange: (value: string) => void;
  onFilterGuideChange: (value: string) => void;
  onFilterDateFromChange: (value: string) => void;
  onFilterDateToChange: (value: string) => void;
  onFilterSeriesChange: (value: SeriesFilter) => void;
  onClearFilters: () => void;
  onToggleSeriesAccordion: (series: string) => void;
  onToggleGuideConfirmation: (bookingId: string, guideName: string, isConfirmed: boolean) => void;
  onManageBooking: (booking: TimelineBooking) => void;
};

export function TimelineBookingsTab({
  allClients,
  allCountries,
  modalSearchTerm,
  modalFilterClient,
  modalFilterCountry,
  modalFilterGuide,
  modalFilterDateFrom,
  modalFilterDateTo,
  modalFilterSeries,
  groupedBySeries,
  expandedSeries,
  getSeriesStats,
  getStatusBadge,
  onSearchTermChange,
  onFilterClientChange,
  onFilterCountryChange,
  onFilterGuideChange,
  onFilterDateFromChange,
  onFilterDateToChange,
  onFilterSeriesChange,
  onClearFilters,
  onToggleSeriesAccordion,
  onToggleGuideConfirmation,
  onManageBooking,
}: TimelineBookingsTabProps) {
  const hasActiveFilters =
    Boolean(modalFilterCountry) ||
    Boolean(modalFilterClient) ||
    Boolean(modalSearchTerm) ||
    Boolean(modalFilterGuide) ||
    Boolean(modalFilterDateFrom) ||
    Boolean(modalFilterDateTo) ||
    modalFilterSeries !== "all";
  console.log("TimeLines");
  
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#C4E8FF]/10">
      <div className="px-6 py-4 border-b border-[#C4E8FF] bg-white shrink-0 flex items-center gap-3 flex-wrap shadow-sm z-10 relative">
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#1D3663]/45" />
          <input
            type="text"
            value={modalSearchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Ref or Group Name..."
            className="w-full bg-white border border-[#C4E8FF] rounded-xl pl-9 py-2 text-xs font-medium text-[#1D3663] placeholder:text-[#1D3663]/45 focus:ring-1 focus:ring-[#F3796A] outline-none"
          />
        </div>

        <input
          type="text"
          list="modal-clients"
          placeholder="Client..."
          value={modalFilterClient}
          onChange={(event) => onFilterClientChange(event.target.value)}
          className="bg-white border border-[#C4E8FF] rounded-xl px-3 py-2 text-xs font-medium text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none w-36"
        />
        <datalist id="modal-clients">
          {allClients.map((client) => (
            <option key={client} value={client} />
          ))}
        </datalist>

        <input
          type="text"
          list="modal-countries"
          placeholder="Country..."
          value={modalFilterCountry}
          onChange={(event) => onFilterCountryChange(event.target.value)}
          className="bg-white border border-[#C4E8FF] rounded-xl px-3 py-2 text-xs font-medium text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none w-36"
        />
        <datalist id="modal-countries">
          {allCountries.map((country) => (
            <option key={country} value={country} />
          ))}
        </datalist>

        <input
          type="text"
          placeholder="Guide Name..."
          value={modalFilterGuide}
          onChange={(event) => onFilterGuideChange(event.target.value)}
          className="bg-white border border-[#C4E8FF] rounded-xl px-3 py-2 text-xs font-medium text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none w-32"
        />

        <div className="flex items-center gap-1 border border-[#C4E8FF] rounded-xl bg-white px-2">
          <span className="text-[9px] font-bold text-[#1D3663]/65 uppercase">From</span>
          <input
            type="date"
            value={modalFilterDateFrom}
            onChange={(event) => onFilterDateFromChange(event.target.value)}
            className="bg-transparent border-none px-1 py-1.5 text-xs text-[#1D3663] outline-none"
          />
          <div className="w-px h-4 bg-[#C4E8FF] mx-1"></div>
          <span className="text-[9px] font-bold text-[#1D3663]/65 uppercase">To</span>
          <input
            type="date"
            value={modalFilterDateTo}
            onChange={(event) => onFilterDateToChange(event.target.value)}
            className="bg-transparent border-none px-1 py-1.5 text-xs text-[#1D3663] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-[#C4E8FF]/20 px-2 py-1.5 rounded-lg border border-[#C4E8FF]">
          <label className="text-[10px] font-bold text-[#1D3663] flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="modalSeries"
              value="all"
              checked={modalFilterSeries === "all"}
              onChange={() => onFilterSeriesChange("all")}
            />
            All
          </label>
          <label className="text-[10px] font-bold text-[#1D3663] flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="modalSeries"
              value="series"
              checked={modalFilterSeries === "series"}
              onChange={() => onFilterSeriesChange("series")}
            />
            Series
          </label>
          <label className="text-[10px] font-bold text-[#1D3663] flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="modalSeries"
              value="noseries"
              checked={modalFilterSeries === "noseries"}
              onChange={() => onFilterSeriesChange("noseries")}
            />
            No Series
          </label>
        </div>

        {hasActiveFilters && (
          <button onClick={onClearFilters} className="text-xs font-bold text-[#F3796A] hover:underline ml-auto">
            Clear Filters
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {Object.keys(groupedBySeries).length === 0 ? (
          <div className="text-center text-[#1D3663]/55 py-10 font-bold">No matching bookings found.</div>
        ) : (
          Object.entries(groupedBySeries).map(([series, bookingsInSeries]) => {
            const isExpanded = expandedSeries.has(series);
            const stats = getSeriesStats(bookingsInSeries);

            return (
              <div key={series} className="bg-white border border-[#C4E8FF] rounded-2xl overflow-hidden shadow-sm transition-all">
                <button
                  onClick={() => onToggleSeriesAccordion(series)}
                  className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#C4E8FF]/10 transition-colors text-left gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-[#F3796A] shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[#1D3663]/45 shrink-0" />
                    )}
                    <h3 className="font-black text-[#F3796A] text-base uppercase tracking-tight flex items-center gap-2">
                      {series}
                      {series !== "NO SERIES" && (
                        <span className="text-[10px] text-[#1D3663]/50 font-bold uppercase tracking-widest">
                          Series
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/65">
                      {stats.total} Total
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#F3796A]">
                      {stats.assigned} Assigned
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/65">
                      {stats.notAssigned} Not Assigned
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#F3796A]">
                      {stats.cancelled} Cancelled
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#F3796A]">
                      {stats.onRequest} On Request
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]">
                      {stats.confirmed} Confirmed
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-white border-t border-[#C4E8FF] overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="bg-[#C4E8FF]/20">
                          <th className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">
                            Booking Ref / Group
                          </th>
                          <th className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF] w-40">
                            Client
                          </th>
                          <th className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF] min-w-[160px]">
                            Country
                          </th>
                          <th className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">
                            Travel Date
                          </th>
                          <th className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">
                            Booking Status
                          </th>
                          <th className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">
                            Guide(s) Assigned
                          </th>
                          <th className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF] text-right">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#C4E8FF]/70">
                        {bookingsInSeries.map((booking) => {
                          const startDateObj = new Date(booking.startDay);
                          const endDateObj = new Date(startDateObj.getTime() + (booking.duration - 1) * 86400000);
                          const endDateStr = endDateObj.toISOString().split("T")[0];

                          return (
                            <tr key={booking.id} className="hover:bg-[#C4E8FF]/10 transition-colors group">
                              <td className="px-6 py-3 align-top">
                                <div className="font-black text-xs text-black truncate max-w-[260px]" title={booking.ref}>
                                  {booking.ref}
                                </div>
                                <div className="font-bold text-[11px] text-black mt-0.5">{booking.groupName}</div>
                              </td>
                              <td className="px-6 py-3 align-top">
                                <div className="font-bold text-xs text-[#1D3663] truncate max-w-[150px]" title={booking.client}>
                                  {booking.client}
                                </div>
                              </td>
                              <td className="px-6 py-3 align-top">
                                <div className="font-bold text-xs text-[#1D3663] break-words">{booking.country || "N/A"}</div>
                              </td>
                              <td className="px-6 py-3 align-top">
                                <div className="font-bold text-xs text-[#1D3663] whitespace-nowrap">
                                  {booking.startDay} to {endDateStr}
                                </div>
                                <div className="text-[10px] font-bold text-[#1D3663]/45">{booking.duration} Days</div>
                              </td>
                              <td className="px-6 py-3 align-top">{getStatusBadge(booking.status)}</td>
                              <td className="px-6 py-3 align-top">
                                <div className="flex flex-col gap-2">
                                  {booking.assignedGuides.length === 0 ? (
                                    <span className="text-[#1D3663]/45 font-bold text-xs italic">Not Assigned</span>
                                  ) : (
                                    booking.assignedGuides.map((guideName) => {
                                      const isConfirmed = booking.confirmedGuides?.includes(guideName);

                                      return (
                                        <div key={guideName} className="flex items-center gap-4">
                                          <span
                                            className={`text-xs font-medium w-28 truncate ${
                                              booking.status?.toLowerCase() === "cancelled"
                                                ? "text-[#1D3663]/45 line-through"
                                                : "text-[#1D3663]/70"
                                            }`}
                                          >
                                            {guideName}
                                          </span>
                                          <div
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              onToggleGuideConfirmation(booking.id, guideName, isConfirmed);
                                            }}
                                            className="flex items-center gap-1.5 cursor-pointer group"
                                          >
                                            <div
                                              className={`w-[14px] h-[14px] rounded-full border-[2px] flex items-center justify-center transition-all ${
                                                isConfirmed ? "border-[#1D3663] bg-[#1D3663]" : "border-[#C4E8FF] bg-white"
                                              }`}
                                            >
                                              {isConfirmed && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                            </div>
                                            <span
                                              className={`text-[10px] uppercase tracking-wider font-bold ${
                                                isConfirmed ? "text-[#1D3663]" : "text-[#F3796A] group-hover:text-[#F3796A]/80"
                                              }`}
                                            >
                                              {isConfirmed ? "ACCEPTED" : "WAITING"}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3 text-right align-top">
                                <button
                                  onClick={() => onManageBooking(booking)}
                                  className="bg-[#1D3663] text-white px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest hover:brightness-95 transition-all shadow-sm active:scale-95 flex items-center justify-center ml-auto"
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
