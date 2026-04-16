import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { Star, Mail, Phone, Calendar, MapPin } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { mockApi } from "../mock/api";
import type { GuideProfileData } from "../mock/types";

export function GuideProfile() {
  const { id } = useParams();
  const guideId = Number(id);
  const currentYear = new Date().getFullYear();
  const [guideData, setGuideData] = useState<GuideProfileData | null>(null);

  useEffect(() => {
    let active = true;

    if (Number.isNaN(guideId)) {
      setGuideData(null);
      return;
    }

    void (async () => {
      const result = await mockApi.getGuideProfile(guideId);
      if (active) {
        setGuideData(result);
      }
    })();

    return () => {
      active = false;
    };
  }, [guideId]);

  return (
    <div className="flex flex-col min-h-screen bg-[#C4E8FF]/10 font-sans text-[#1D3663]">
      <header className="h-16 bg-white border-b border-[#C4E8FF] flex items-center justify-between px-6 shrink-0 z-50 shadow-sm sticky top-0">
        <div className="flex items-center gap-8 h-full">
          <h1 className="text-xl font-bold text-[#1D3663] mr-4">Guide Management</h1>
          <nav className="flex h-full gap-6">
            <Link
              to="/timeline?tab=calendar"
              className="h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] border-transparent transition-colors text-[#1D3663]/50 hover:text-[#1D3663]"
            >
              Calendar
            </Link>
            <Link
              to="/timeline?tab=bookings"
              className="h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] border-transparent transition-colors text-[#1D3663]/50 hover:text-[#1D3663]"
            >
              Bookings
            </Link>
            <Link
              to="/guides"
              className="h-full flex items-center px-2 font-black uppercase tracking-widest text-xs border-b-[3px] border-[#F3796A] text-[#F3796A] transition-colors cursor-default"
            >
              Guides
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to={`/guides/${id}/edit`}
            className="px-4 py-1.5 bg-[#F3796A] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-95 transition-all shadow-sm active:scale-95"
          >
            Edit Profile
          </Link>
          <div className="w-8 h-8 rounded-full bg-[#1D3663] flex items-center justify-center text-white font-bold text-xs">
            U
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {!guideData ? (
          <section className="bg-white rounded-2xl shadow-sm border border-[#C4E8FF] p-10 text-center">
            <h2 className="text-2xl font-black text-[#1D3663]">Guide not found</h2>
            <p className="text-sm font-medium text-[#1D3663]/60 mt-2">
              This guide profile is unavailable or has been removed.
            </p>
            <Link
              to="/guides"
              className="inline-flex mt-6 px-5 py-2.5 bg-[#1D3663] text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              Back to Guides
            </Link>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <aside className="lg:col-span-1 space-y-6">
              <section className="bg-white rounded-2xl shadow-sm border border-[#C4E8FF] overflow-hidden">
                <div className="p-6 text-center">
                  <div className="w-32 h-32 mx-auto mb-4">
                    <ImageWithFallback
                      src={guideData.avatar}
                      alt="Guide Profile Picture"
                      className="w-full h-full object-cover rounded-full border-4 border-white shadow-sm"
                    />
                  </div>
                  <h2 className="text-2xl font-black text-[#1D3663]">{guideData.name}</h2>
                  <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-[#C4E8FF]/40 text-[#1D3663]">
                      {guideData.fullTime ? "Full-time" : "Part-time"}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                        guideData.status === "Active"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-[#F3796A]/10 text-[#F3796A] border-[#F3796A]/20"
                      }`}
                    >
                      {guideData.status}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1D3663]/55">
                      {guideData.whtSummary}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {guideData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-white border border-[#C4E8FF] text-[#1D3663]/65 text-[9px] font-black rounded uppercase tracking-widest"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#C4E8FF]/50 p-6 space-y-4">
                  <h3 className="text-[9px] font-black text-[#1D3663]/50 uppercase tracking-widest">
                    Basic Information
                  </h3>
                  <div className="flex items-center gap-3 text-sm font-medium text-[#1D3663]">
                    <Mail className="w-5 h-5 text-[#F3796A]" />
                    <span>{guideData.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-[#1D3663]">
                    <Phone className="w-5 h-5 text-[#F3796A]" />
                    <span>{guideData.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-[#1D3663]">
                    <Calendar className="w-5 h-5 text-[#F3796A]" />
                    <span>{guideData.dateOfBirth}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-[#1D3663]">
                    <MapPin className="w-5 h-5 text-[#F3796A]" />
                    <span>{guideData.location}</span>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-sm border border-[#C4E8FF] p-6 space-y-6">
                <div>
                  <h3 className="text-[9px] font-black text-[#1D3663]/50 uppercase tracking-widest mb-3">
                    Professional Languages
                  </h3>
                  <div className="space-y-2">
                    {guideData.languages.map((lang) => (
                      <div key={`${lang.language}-${lang.level}`} className="flex justify-between items-center">
                        <span className="text-[#1D3663] font-bold text-sm">{lang.language}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#1D3663]/60 bg-[#C4E8FF]/20 px-2 py-0.5 rounded border border-[#C4E8FF]">
                          {lang.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[9px] font-black text-[#1D3663]/50 uppercase tracking-widest mb-3">
                    Licenses & Certifications
                  </h3>
                  <ul className="space-y-3">
                    {guideData.certifications.map((cert) => (
                      <li key={cert.id} className="flex items-start gap-3">
                        <div className="mt-1 p-1 bg-[#F3796A]/10 rounded border border-[#F3796A]/20">
                          <Star className="w-3 h-3 text-[#F3796A] fill-[#F3796A]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1D3663]">{cert.name}</p>
                          <p className="text-[10px] font-bold text-[#1D3663]/55 uppercase mt-0.5">
                            {cert.expiry || cert.org}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-[#C4E8FF]/50">
                  <h3 className="text-[9px] font-black text-[#1D3663]/50 uppercase tracking-widest mb-2">
                    Tour Record
                  </h3>
                  <p className="text-xs font-medium text-[#1D3663]/80 leading-relaxed italic border-l-2 border-[#F3796A] pl-3 py-1">
                    {guideData.tourRecord}
                  </p>
                </div>
              </section>
            </aside>

            <div className="lg:col-span-2 space-y-8">
              <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#C4E8FF]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#1D3663]/50 mb-1">
                    Total Tours
                  </p>
                  <p className="text-2xl font-black text-[#1D3663]">{guideData.stats.totalTours}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#C4E8FF]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#1D3663]/50 mb-1">
                    Avg Rating
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-2xl font-black text-[#1D3663]">{guideData.stats.avgRating}</p>
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#C4E8FF]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#1D3663]/50 mb-1">
                    Years Exp.
                  </p>
                  <p className="text-2xl font-black text-[#1D3663]">{guideData.stats.yearsExp}</p>
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-sm border border-[#C4E8FF] p-8">
                <h3 className="text-base font-black text-[#1D3663] uppercase tracking-tight mb-4">
                  About {guideData.name.split(" ")[0]}
                </h3>
                <div className="max-w-none space-y-4">
                  {guideData.bio.map((paragraph, index) => (
                    <p key={`${guideData.id}-${index}`} className="text-[#1D3663]/80 font-medium text-sm leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-sm border border-[#C4E8FF] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#C4E8FF] flex justify-between items-center bg-[#C4E8FF]/10">
                  <h3 className="text-sm font-black text-[#1D3663] uppercase tracking-wide">
                    Upcoming Tours
                  </h3>
                  <Link
                    to={`/timeline?tab=calendar&guideId=${guideData.id}&year=${currentYear}`}
                    className="text-[9px] font-black uppercase tracking-widest text-[#F3796A] hover:underline"
                  >
                    View Schedule
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white border-b border-[#C4E8FF]">
                      <tr>
                        <th className="px-6 py-3 text-[9px] font-black text-[#1D3663]/60 uppercase tracking-widest">
                          Date
                        </th>
                        <th className="px-6 py-3 text-[9px] font-black text-[#1D3663]/60 uppercase tracking-widest">
                          Tour Name
                        </th>
                        <th className="px-6 py-3 text-[9px] font-black text-[#1D3663]/60 uppercase tracking-widest">
                          Client
                        </th>
                        <th className="px-6 py-3 text-[9px] font-black text-[#1D3663]/60 uppercase tracking-widest">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#C4E8FF]/50 bg-white">
                      {guideData.upcomingTours.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-6 text-center text-xs font-bold text-[#1D3663]/45 italic"
                          >
                            No upcoming tours assigned.
                          </td>
                        </tr>
                      ) : (
                        guideData.upcomingTours.map((tour) => (
                          <tr key={tour.id} className="hover:bg-[#C4E8FF]/10 transition-colors group">
                            <td className="px-6 py-4 text-xs font-bold text-[#1D3663] whitespace-nowrap">
                              {tour.date}
                            </td>
                            <td className="px-6 py-4 text-sm font-black text-[#1D3663]">{tour.name}</td>
                            <td className="px-6 py-4 text-xs font-bold text-[#1D3663]/70">{tour.client}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest ${
                                  tour.status === "Confirmed" ? "text-[#1D3663]" : "text-[#F3796A]"
                                }`}
                              >
                                {tour.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
