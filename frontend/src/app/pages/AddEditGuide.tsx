import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  User,
  Briefcase,
  Camera,
  UploadCloud,
  FileCheck,
  Globe,
  FileText,
  X,
  Plus,
  LoaderCircle,
} from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  PROFICIENCY_LEVELS,
  getWhtTaxByType,
  mockApi,
} from "../mock/api";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import type { GuideFormData, WhtType } from "../mock/types";

export function AddEditGuide() {
  const { id } = useParams();
  const navigate = useNavigate();
  const parsedGuideId = Number(id);
  const guideId = Number.isNaN(parsedGuideId) ? undefined : parsedGuideId;

  const [formData, setFormData] = useState<GuideFormData>({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    city: "",
    licenseName: "",
    startDateWithUs: "",
    tourRecord: "",
    whtType: "Resident",
    whtTax: getWhtTaxByType("Resident"),
    status: "Active",
    tags: [],
    languages: [{ language: "English", proficiency: "Intermediate" }],
    biography: "",
  });
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [newTagValue, setNewTagValue] = useState("");
  const [cityOptions, setCityOptions] = useState<{ city: string; country: string }[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [guideFormData, nextTagOptions, nextCityOptions] = await Promise.all([
          mockApi.getGuideFormData(guideId),
          mockApi.getGuideClientTags(),
          mockApi.getCityOptions(),
        ]);

        if (!active) return;
        setFormData(guideFormData);
        setTagOptions(nextTagOptions);
        setCityOptions(nextCityOptions);
      } finally {
        if (active) {
          setIsInitialLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [guideId]);

  const selectedCity = useMemo(
    () => cityOptions.find((option) => option.city.toLowerCase() === formData.city.trim().toLowerCase()) ?? null,
    [cityOptions, formData.city],
  );

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((item) => item !== tag) : [...prev.tags, tag],
    }));
  };

  const addLanguage = () => {
    setFormData((prev) => ({
      ...prev,
      languages: [...prev.languages, { language: "English", proficiency: "Intermediate" }],
    }));
  };

  const removeLanguage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateLanguage = (index: number, field: "language" | "proficiency", value: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.map((language, itemIndex) =>
        itemIndex === index ? { ...language, [field]: value } : language,
      ),
    }));
  };

  const updateField = <Key extends keyof GuideFormData>(field: Key, value: GuideFormData[Key]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWhtTypeChange = (value: WhtType) => {
    setFormData((prev) => ({
      ...prev,
      whtType: value,
      whtTax: getWhtTaxByType(value),
    }));
  };

  const handleCreateTag = async () => {
    const normalizedTag = newTagValue.trim().toUpperCase();
    if (!normalizedTag) {
      return;
    }

    setIsTagLoading(true);
    try {
      const nextOptions = await mockApi.createGuideClientTag(normalizedTag);
      setTagOptions(nextOptions);
      setFormData((prev) => ({
        ...prev,
        tags: prev.tags.includes(normalizedTag) ? prev.tags : [...prev.tags, normalizedTag],
      }));
      setNewTagValue("");
    } finally {
      setIsTagLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await mockApi.saveGuide({
        ...formData,
        id: guideId ?? formData.id,
      });
      navigate("/guides");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#C4E8FF]/10 overflow-hidden font-sans text-[#1D3663] w-full">
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
            to="/guides"
            className="px-4 py-1.5 bg-white border border-[#C4E8FF] text-[#1D3663] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#C4E8FF]/20 transition-all"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#F3796A] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-95 transition-all shadow-sm active:scale-95"
          >
            <span className="inline-flex items-center gap-2">
              {isSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Save Guide
            </span>
          </button>
          <div className="w-8 h-8 rounded-full bg-[#1D3663] flex items-center justify-center text-white font-bold text-xs">
            U
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col h-full relative overflow-y-auto p-6 md:p-8">
        {(isInitialLoading || isSaving) && (
          <LoadingOverlay label={isSaving ? "Saving guide..." : "Loading guide form..."} />
        )}
        <div className="max-w-[1400px] w-full mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 pb-20">
          <div className="xl:col-span-7 space-y-6">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF]">
              <h3 className="font-black text-[#1D3663] text-sm uppercase tracking-tight flex items-center gap-2 mb-6 border-b border-[#C4E8FF]/50 pb-3">
                <User className="w-4 h-4 text-[#F3796A]" /> Basic Identity
              </h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(event) => updateField("dateOfBirth", event.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium text-[#1D3663] focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    City
                  </label>
                  <input
                    type="text"
                    list="guide-city-options"
                    value={formData.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    placeholder="Select a city from the DB"
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                  <datalist id="guide-city-options">
                    {cityOptions.map((option) => (
                      <option key={`${option.city}-${option.country}`} value={option.city} />
                    ))}
                  </datalist>
                  <div className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1D3663]/50">
                    {selectedCity ? `Country: ${selectedCity.country}` : "City is linked to the backend catalog"}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    License / Certification Name
                  </label>
                  <input
                    type="text"
                    value={formData.licenseName}
                    onChange={(event) => updateField("licenseName", event.target.value)}
                    placeholder="e.g. International Tour Guide License #12345"
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF]">
              <h3 className="font-black text-[#1D3663] text-sm uppercase tracking-tight flex items-center gap-2 mb-6 border-b border-[#C4E8FF]/50 pb-3">
                <Briefcase className="w-4 h-4 text-[#F3796A]" /> Employment & Tax Setup
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-[#C4E8FF]/10 p-4 rounded-xl border border-[#C4E8FF]">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest block">
                    Start Date With Us
                  </label>
                  <input
                    type="date"
                    value={formData.startDateWithUs}
                    onChange={(event) => updateField("startDateWithUs", event.target.value)}
                    className="bg-transparent font-bold text-sm text-[#1D3663] focus:outline-none mt-1 outline-none border-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Tour Record Details
                  </label>
                  <input
                    type="text"
                    value={formData.tourRecord}
                    onChange={(event) => updateField("tourRecord", event.target.value)}
                    placeholder="Summary of key tours or regions covered..."
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>

                <div className="bg-white border border-[#C4E8FF] p-4 rounded-xl">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest block">
                    WHT Type
                  </label>
                  <select
                    value={formData.whtType}
                    onChange={(event) => handleWhtTypeChange(event.target.value as WhtType)}
                    className="w-full bg-transparent font-black text-sm text-[#1D3663] outline-none mt-1"
                  >
                    <option value="Resident">Resident</option>
                    <option value="Non-resident">Non-resident</option>
                  </select>
                </div>

                <div className="bg-[#C4E8FF]/20 border border-[#C4E8FF] p-4 rounded-xl">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest block">
                    WHT Tax
                  </label>
                  <div className="mt-1 text-lg font-black text-[#1D3663]">{formData.whtTax.toFixed(2)}%</div>
                </div>

                <div className="bg-[#C4E8FF]/20 p-1.5 rounded-xl flex gap-1 h-fit my-auto border border-[#C4E8FF]">
                  <button
                    type="button"
                    onClick={() => updateField("status", "Active")}
                    className={`flex-1 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest shadow-sm ${
                      formData.status === "Active" ? "bg-[#1D3663] text-white" : "text-[#1D3663]/55"
                    }`}
                  >
                    ACTIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("status", "Inactive")}
                    className={`flex-1 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${
                      formData.status === "Inactive" ? "bg-[#1D3663] text-white shadow-sm" : "text-[#1D3663]/55"
                    }`}
                  >
                    INACTIVE
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="xl:col-span-5 space-y-6">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF]">
              <h3 className="font-black text-[#1D3663] text-sm uppercase tracking-tight flex items-center gap-2 mb-6 border-b border-[#C4E8FF]/50 pb-3">
                <Globe className="w-4 h-4 text-[#F3796A]" /> Language Skills
              </h3>
              <div className="space-y-3">
                {formData.languages.map((lang, idx) => (
                  <div key={`${idx}-${lang.language}`} className="flex gap-2">
                    <select
                      value={lang.language}
                      onChange={(event) => updateLanguage(idx, "language", event.target.value)}
                      className="flex-1 bg-white border border-[#C4E8FF] rounded-lg text-xs font-bold text-[#1D3663] py-2.5 px-3 focus:ring-1 focus:ring-[#F3796A] outline-none"
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                    <select
                      value={lang.proficiency}
                      onChange={(event) => updateLanguage(idx, "proficiency", event.target.value)}
                      className="w-28 bg-white border border-[#C4E8FF] rounded-lg text-xs font-bold text-[#1D3663] py-2.5 px-3 focus:ring-1 focus:ring-[#F3796A] outline-none"
                    >
                      {PROFICIENCY_LEVELS.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeLanguage(idx)}
                      className="text-[#1D3663]/40 hover:text-[#F3796A] p-2 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLanguage}
                  className="text-[10px] font-bold text-[#F3796A] flex items-center gap-1 uppercase hover:underline mt-2"
                >
                  <Plus className="w-3 h-3" /> Add Language
                </button>
              </div>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF]">
              <h3 className="font-black text-[#1D3663] text-sm uppercase tracking-tight flex items-center gap-2 mb-4 border-b border-[#C4E8FF]/50 pb-3">
                <Camera className="w-4 h-4 text-[#F3796A]" /> Profile Assets
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-2 border-dashed border-[#C4E8FF] rounded-xl p-5 flex flex-col items-center justify-center bg-white hover:bg-[#C4E8FF]/10 transition-all cursor-pointer">
                  <UploadCloud className="w-6 h-6 text-[#1D3663]/40 mb-2" />
                  <span className="text-[9px] font-black text-[#1D3663]/60 uppercase tracking-widest text-center">
                    Upload Photo
                  </span>
                </div>
                <div className="border border-[#C4E8FF] rounded-xl p-5 bg-[#C4E8FF]/10 flex flex-col items-center justify-center">
                  <FileCheck className="w-6 h-6 text-[#1D3663] mb-2" />
                  <span className="text-[9px] font-black text-[#1D3663] uppercase tracking-widest">
                    License Doc
                  </span>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF]">
              <h3 className="font-black text-[#1D3663] text-sm uppercase tracking-tight flex items-center gap-2 mb-4 border-b border-[#C4E8FF]/50 pb-3">
                <FileText className="w-4 h-4 text-[#F3796A]" /> Client Tags & Biography
              </h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagValue}
                    onChange={(event) => setNewTagValue(event.target.value)}
                    placeholder="Create client tag..."
                    className="flex-1 bg-white border border-[#C4E8FF] rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={isTagLoading}
                    className="px-4 py-2.5 bg-[#1D3663] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-95 transition-all"
                  >
                    <span className="inline-flex items-center gap-2">
                      {isTagLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                      Add Tag
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {tagOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                        formData.tags.includes(tag)
                          ? "bg-[#1D3663] border-[#1D3663] text-white"
                          : "border-[#C4E8FF] text-[#1D3663]/65 bg-white hover:border-[#1D3663]/30"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={6}
                  value={formData.biography}
                  onChange={(event) => updateField("biography", event.target.value)}
                  placeholder="Provide a detailed description of the guide's background and personal touch..."
                  className="w-full bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium p-4 focus:ring-1 focus:ring-[#F3796A] outline-none placeholder:text-[#1D3663]/40"
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
