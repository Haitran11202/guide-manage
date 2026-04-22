import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  User,
  Briefcase,
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
    address: "",
    city: "",
    country: "",
    partTime: true,
    licenseName: "",
    startDateWithUs: "",
    tourRecord: "",
    notes: "",
    taxCode: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    whtType: "Resident",
    whtTax: getWhtTaxByType("Resident"),
    status: "Active",
    appearance: "",
    languages: [{ language: "English", proficiency: "Intermediate" }],
    biography: "",
  });
  const [tagInput, setTagInput] = useState("");
  const [cityOptions, setCityOptions] = useState<{ city: string; country: string }[]>([]);
  const [countryOptions, setCountryOptions] = useState<{ xid: number; name: string }[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [guideFormData, nextCityOptions, nextCountryOptions] = await Promise.all([
          mockApi.getGuideFormData(guideId),
          mockApi.getCityOptions(),
          mockApi.getCountryOptions(),
        ]);

        if (!active) return;
        setFormData(guideFormData);
        setCityOptions(nextCityOptions);
        setCountryOptions(nextCountryOptions);
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

  const visibleCountryOptions = useMemo(() => {
    if (!selectedCity?.country) {
      return countryOptions;
    }

    return countryOptions.filter((option) => option.name === selectedCity.country);
  }, [countryOptions, selectedCity]);

  useEffect(() => {
    if (!selectedCity) {
      return;
    }

    if (formData.country !== selectedCity.country) {
      setFormData((prev) => ({
        ...prev,
        country: selectedCity.country,
      }));
    }
  }, [selectedCity, formData.country]);

  const appearanceTags = useMemo(
    () =>
      formData.appearance
        .split(",")
        .map((value) => value.trim())
        .filter((value, index, items) => value.length > 0 && items.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index),
    [formData.appearance],
  );

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

  const handleCityChange = (value: string) => {
    const matchedCity = cityOptions.find((option) => option.city === value) ?? null;
    setFormData((prev) => ({
      ...prev,
      city: value,
      country: matchedCity?.country ?? prev.country,
    }));
  };

  const updateAppearanceTags = (tags: string[]) => {
    updateField("appearance", tags.join(", "));
  };

  const handleAddTags = () => {
    const nextTags = tagInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (nextTags.length === 0) {
      return;
    }

    const mergedTags = [...appearanceTags];
    nextTags.forEach((tag) => {
      if (!mergedTags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
        mergedTags.push(tag);
      }
    });

    updateAppearanceTags(mergedTags);
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateAppearanceTags(appearanceTags.filter((tag) => tag !== tagToRemove));
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
        <div className="max-w-[1400px] w-full mx-auto grid grid-cols-1 items-stretch xl:grid-cols-12 gap-6 pb-20">
          <div className="xl:col-span-7 space-y-6">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF]">
              <div className="mb-6 flex flex-col gap-3 border-b border-[#C4E8FF]/50 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-black text-[#1D3663] text-sm uppercase tracking-tight flex items-center gap-2">
                  <User className="w-4 h-4 text-[#F3796A]" /> Basic Identity
                </h3>
                <div className="w-full bg-[#C4E8FF]/20 p-1.5 rounded-xl flex gap-1 border border-[#C4E8FF] sm:h-fit sm:w-auto sm:min-w-[260px]">
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
                    Address
                  </label>
                  <input
                    type="text"
                    list="guide-city-options"
                    value={formData.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    placeholder="Enter address"
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    City
                  </label>
                  <select
                    value={formData.city}
                    onChange={(event) => handleCityChange(event.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  >
                    <option value="">Select city</option>
                    {cityOptions.map((option) => (
                      <option key={`${option.city}-${option.country}`} value={option.city}>
                        {option.city}
                      </option>
                    ))}
                  </select>
                  
                </div>

                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Country
                  </label>
                  <select
                    value={formData.country}
                    onChange={(event) => updateField("country", event.target.value)}
                    disabled={!!selectedCity}
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  >
                    <option value="">Select country</option>
                    {visibleCountryOptions.map((option) => (
                      <option key={option.xid} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Work Type
                  </label>
                  <select
                    value={formData.partTime ? "part-time" : "full-time"}
                    onChange={(event) => updateField("partTime", event.target.value === "part-time")}
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  >
                    <option value="part-time">Part-time</option>
                    <option value="full-time">Full-time</option>
                  </select>
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
                    Tax Code
                  </label>
                  <input
                    type="text"
                    value={formData.taxCode}
                    onChange={(event) => updateField("taxCode", event.target.value)}
                    placeholder="Enter tax code"
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(event) => updateField("bankName", event.target.value)}
                    placeholder="Enter bank name"
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(event) => updateField("bankAccountNumber", event.target.value)}
                    placeholder="Enter account number"
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Bank Account Name
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountName}
                    onChange={(event) => updateField("bankAccountName", event.target.value)}
                    placeholder="Enter account name"
                    className="w-full mt-1 px-4 py-2.5 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none"
                  />
                </div>

                {/* <div className="col-span-2">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Biography
                  </label>
                  <textarea
                    rows={4}
                    value={formData.tourRecord}
                    onChange={(event) => updateField("tourRecord", event.target.value)}
                    placeholder="Enter the guide biography or tour record details..."
                    className="w-full mt-1 px-4 py-3 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none placeholder:text-[#1D3663]/40"
                  />
                </div> */}

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
              </div>
            </section>
          </div>

          <div className="xl:col-span-5 flex flex-col gap-6 h-full">
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

            {/* <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF]">
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
            </section> */}

            <section className="flex-1 bg-white rounded-2xl p-6 shadow-sm border border-[#C4E8FF] flex flex-col">
              <h3 className="font-black text-[#1D3663] text-sm uppercase tracking-tight flex items-center gap-2 mb-4 border-b border-[#C4E8FF]/50 pb-3">
                <FileText className="w-4 h-4 text-[#F3796A]" /> Client Tags
              </h3>
              <div className="flex-[4] flex flex-col space-y-4 min-h-0">
                <div className="min-h-[2.5rem] flex-1 rounded-xl border border-[#C4E8FF] bg-white p-3 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {appearanceTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-2 rounded-full border border-[#C4E8FF] bg-[#C4E8FF]/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#1D3663]"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#1D3663]/60 transition-colors hover:text-[#F3796A]"
                          aria-label={`Remove ${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddTags();
                        }
                      }}
                      placeholder={appearanceTags.length === 0 ? "Type a tag and press Enter" : "Add another tag"}
                      className="min-w-[12rem] flex-1 border-none bg-transparent px-1 py-1 text-xs font-medium text-[#1D3663] outline-none placeholder:text-[#1D3663]/40"
                    />
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1D3663]/50">
                  Press `Enter` to create a tag. You can also paste multiple tags separated by commas.
                </p>
              </div>
              <div className="flex-[4] min-h-0">
                <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                  Biography
                </label>
                <textarea
                  rows={4}
                  value={formData.biography}
                  onChange={(event) => updateField("biography", event.target.value)}
                  placeholder="Enter the guide biography..."
                  className="w-full h-[calc(100%-1.5rem)] mt-1 px-4 py-3 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none placeholder:text-[#1D3663]/40 resize-none"
                />
              </div>
              <div className="flex-[4] min-h-0">
                  <label className="text-[9px] font-black text-[#1D3663]/55 uppercase tracking-widest">
                    Notes
                  </label>
                  <textarea
                    rows={8}
                    value={formData.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder="Enter guide notes..."
                    className="w-full mt-1 px-4 py-3 bg-white border border-[#C4E8FF] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F3796A] outline-none placeholder:text-[#1D3663]/40"
                  />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
