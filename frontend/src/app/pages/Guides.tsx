import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, UserPlus, X, Calendar } from "lucide-react";
import { mockApi } from "../mock/api";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import type { GuideDirectoryItem } from "../mock/types";

export function Guides() {
  const [guides, setGuides] = useState<GuideDirectoryItem[]>([]);
  const [guideTagOptions, setGuideTagOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [guideResults, tagResults] = await Promise.all([
          mockApi.getGuides(),
          mockApi.getGuideClientTags(),
        ]);

        if (!active) return;
        setGuides(guideResults);
        setGuideTagOptions(tagResults);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredGuides = useMemo(() => {
    return guides.filter((guide) => {
      const matchesSearch = guide.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === "All" || guide.status === selectedStatus;
      const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => guide.tags.includes(tag));
      return matchesSearch && matchesStatus && matchesTags;
    });
  }, [guides, searchTerm, selectedTags, selectedStatus]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedTags([]);
    setSelectedStatus("All");
  };

  return (
    <div className="flex flex-col h-screen bg-[#C4E8FF]/20 overflow-hidden font-sans text-[#1D3663] select-none w-full">
      
      {/* GLOBAL STICKY HEADER & TABS */}
      <header className="h-16 bg-white border-b border-[#C4E8FF] flex items-center justify-between px-6 shrink-0 z-50 shadow-sm sticky top-0">
        <div className="flex items-center gap-8 h-full">
          <h1 className="text-xl font-bold text-[#1D3663] mr-4">Guide Management</h1>
          <nav className="flex h-full gap-6">
             <Link to="/timeline?tab=calendar" className="h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] border-transparent transition-colors text-[#1D3663]/50 hover:text-[#1D3663]">Calendar</Link>
             <Link to="/timeline?tab=bookings" className="h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] border-transparent transition-colors text-[#1D3663]/50 hover:text-[#1D3663]">Bookings</Link>
             <Link to="/guides" className="h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] border-[#F3796A] text-[#F3796A] transition-colors cursor-default">Guides</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-[#1D3663] flex items-center justify-center text-white font-bold text-xs">U</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#C4E8FF]/10 relative z-0">
        {isLoading && <LoadingOverlay label="Loading guide directory..." />}
        <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-hidden max-w-[1400px] mx-auto w-full">
          
          {/* Title Section merged with Search & Add actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between shrink-0 gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#1D3663] uppercase tracking-tighter">Guide Directory</h2>
              <p className="text-[10px] font-black text-[#1D3663]/55 uppercase tracking-widest mt-1">
                {filteredGuides.length} matching resources found
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#1D3663]/45" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search guide name..."
                  className="w-full bg-white border border-[#C4E8FF] rounded-xl pl-9 py-2.5 text-xs font-medium text-[#1D3663] placeholder:text-[#1D3663]/45 focus:ring-1 focus:ring-[#F3796A] outline-none shadow-sm"
                />
              </div>
              <Link
                to="/guides/new"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#F3796A] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-95 transition-all shadow-sm active:scale-95 shrink-0"
              >
                <UserPlus className="w-4 h-4" /> Add New Guide
              </Link>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-5 rounded-2xl border border-[#C4E8FF] shadow-sm flex flex-wrap items-start gap-8 shrink-0">
            {/* Status Toggle */}
            <div className="space-y-2">
              <span className="text-[9px] font-black text-[#1D3663]/65 uppercase tracking-widest">Status</span>
              <div className="flex bg-[#C4E8FF]/20 p-1 rounded-xl w-fit border border-[#C4E8FF]">
                {["All", "Active", "Inactive"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      selectedStatus === status 
                      ? "bg-white text-[#1D3663] shadow-sm border border-[#C4E8FF]/50" 
                      : "text-[#1D3663]/65 hover:text-[#1D3663]"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag Selection */}
            <div className="flex-1 space-y-2 min-w-[300px]">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-[#1D3663]/65 uppercase tracking-widest">Client Segments</span>
                {(selectedTags.length > 0 || searchTerm || selectedStatus !== "All") && (
                  <button onClick={clearFilters} className="text-[10px] font-bold text-[#F3796A] uppercase hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear Filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {guideTagOptions.map((tag) => {
                  const isActive = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                        isActive 
                        ? "bg-[#1D3663] border-[#1D3663] text-white shadow-sm" 
                        : "bg-white border-[#C4E8FF] text-[#1D3663]/65 hover:border-[#1D3663]/30"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-[#C4E8FF] bg-white shadow-sm flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-white shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">Guide Name</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">Tags</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">Status</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF] text-center">Type</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF]">Performance</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#1D3663]/70 border-b border-[#C4E8FF] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C4E8FF]/50">
                  {filteredGuides.length > 0 ? (
                    filteredGuides.map((guide) => (
                      <tr key={guide.id} className="group hover:bg-[#C4E8FF]/10 transition-colors">
                        <td className="px-6 py-4">
                            <span className="font-bold text-sm text-[#1D3663]">{guide.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-[#1D3663]/55 uppercase tracking-widest">
                            {guide.tags.join(" • ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${guide.status === "Active" ? "bg-emerald-500" : "bg-[#F3796A]"}`}></div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${guide.status === "Active" ? "text-[#1D3663]" : "text-[#1D3663]/45"}`}>
                              {guide.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${guide.partTime ? "text-[#F3796A]" : "text-[#1D3663]"}`}>
                            {guide.partTime ? "Contract" : "Full-time"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-20 bg-[#C4E8FF]/40 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[#1D3663] h-full" style={{ width: `${guide.rating}%` }}></div>
                            </div>
                            <span className="text-[10px] font-black text-[#1D3663]">{guide.rating}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/guides/${guide.id}`}
                              className="bg-white text-[#1D3663] border border-[#C4E8FF] px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#C4E8FF]/20 transition-all"
                            >
                              Profile
                            </Link>
                            <Link
                              to={`/timeline?tab=calendar&guideId=${guide.id}&year=${new Date().getFullYear()}`}
                              className="bg-[#1D3663] text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-95 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                              <Calendar className="w-3 h-3" /> Schedule
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[#1D3663]/45 font-bold italic text-sm">
                        No guide results match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
