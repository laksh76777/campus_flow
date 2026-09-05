import { useState, useMemo, useRef } from "react";
import {
  Building2,
  Search,
  Plus,
  Globe,
  Mail,
  Phone,
  MapPin,
  Edit,
  Power,
  CheckCircle2,
  XCircle,
  Briefcase,
  X,
  Upload,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  createCompany,
  updateCompany,
  deactivateCompany,
  reactivateCompany,
} from "../../services/adminService";

const COMMON_INDUSTRIES = [
  "Information Technology & Services",
  "Financial Technology (Fintech)",
  "Cloud & SaaS Infrastructure",
  "E-Commerce & Retail Tech",
  "Consulting & Professional Services",
  "Automotive & Electric Vehicles",
  "Healthcare & Life Sciences",
  "Telecommunications & Networking",
];

export default function ManageCompanies({
  companies = [],
  drives = [],
  onRefresh,
  onCreateDriveForCompany,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'active' | 'inactive'
  const [filterIndustry, setFilterIndustry] = useState("all");

  // Edit company modal state
  const [editingCompany, setEditingCompany] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form State
  const fileInputRef = useRef(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  const initialFormState = {
    companyName: "",
    companyDescription: "",
    companyWebsite: "",
    industry: "Information Technology & Services",
    location: "Bengaluru, Karnataka",
    contactEmail: "",
    contactPhone: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  // Compute drives count map per company
  const driveCountsByCompany = useMemo(() => {
    const counts = {};
    drives.forEach((d) => {
      const cId = d.company?._id || d.company;
      if (cId) {
        counts[cId] = (counts[cId] || 0) + 1;
      }
    });
    return counts;
  }, [drives]);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchesSearch =
        c.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        filterStatus === "all"
          ? true
          : filterStatus === "active"
          ? c.isActive !== false
          : c.isActive === false;

      const matchesIndustry =
        filterIndustry === "all" ? true : c.industry === filterIndustry;

      return matchesSearch && matchesStatus && matchesIndustry;
    });
  }, [companies, searchQuery, filterStatus, filterIndustry]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData(initialFormState);
    setLogoFile(null);
    setLogoPreview("");
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      companyName: company.companyName || "",
      companyDescription: company.companyDescription || "",
      companyWebsite: company.companyWebsite || "",
      industry: company.industry || "Information Technology & Services",
      location: company.location || "",
      contactEmail: company.contactEmail || "",
      contactPhone: company.contactPhone || "",
    });
    setLogoFile(null);
    setLogoPreview(company.companyLogo?.url || "");
    setIsEditModalOpen(true);
  };

  // Handle Logo File Selection
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Logo file size must be less than 5MB");
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Create or Edit Company
  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSubmitting(true);
    try {
      let payload;
      if (logoFile) {
        payload = new FormData();
        Object.entries(formData).forEach(([k, v]) => {
          payload.append(k, v);
        });
        payload.append("companyLogo", logoFile);
      } else {
        payload = formData;
      }

      if (editingCompany) {
        await updateCompany(editingCompany._id, formData);
        toast.success("Company profile updated successfully!");
        setIsEditModalOpen(false);
      } else {
        await createCompany(payload);
        toast.success("Company partner registered successfully!");
        setIsCreateModalOpen(false);
      }
      onRefresh();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to save company";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Company Active/Inactive
  const handleToggleStatus = async (company) => {
    const isCurrentlyActive = company.isActive !== false;
    const action = isCurrentlyActive ? "deactivate" : "reactivate";
    const confirm = window.confirm(
      `Are you sure you want to ${action} ${company.companyName}?`
    );
    if (!confirm) return;

    try {
      if (isCurrentlyActive) {
        await deactivateCompany(company._id);
        toast.success(`${company.companyName} deactivated`);
      } else {
        await reactivateCompany(company._id);
        toast.success(`${company.companyName} reactivated`);
      }
      onRefresh();
    } catch (err) {
      const msg = err.response?.data?.message || "Action failed";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Corporate Partners Directory</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-100">
              {filteredCompanies.length} Partners
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage participating recruitment organizations, points of contact, and industry affiliations
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500 transition active:scale-95 self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Register New Partner</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search company name, industry, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            {["all", "active", "inactive"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  filterStatus === status
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Industry Filter */}
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-hidden max-w-[200px] truncate"
          >
            <option value="all">All Industries</option>
            {COMMON_INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Companies Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No corporate partners found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || filterStatus !== "all"
              ? "No companies match the current search filters."
              : "Register your first corporate recruiting partner to begin scheduling placement drives."}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Register Company</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCompanies.map((company) => {
            const logoUrl = company.companyLogo?.url;
            const driveCount = driveCountsByCompany[company._id] || 0;
            const isActive = company.isActive !== false;

            return (
              <div
                key={company._id}
                className={`relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md ${
                  isActive ? "border-slate-200/90" : "border-slate-200 bg-slate-50/50 opacity-80"
                }`}
              >
                <div>
                  {/* Top: Logo & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={company.companyName}
                          className="h-12 w-12 rounded-xl object-contain border border-slate-100 p-1.5 bg-white shadow-xs"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 font-extrabold text-white text-lg shadow-xs">
                          {company.companyName?.charAt(0).toUpperCase() || "C"}
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                          {company.companyName}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-400">
                          {company.industry || "Technology Sector"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Active Partner
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-slate-400" />
                          Inactive
                        </>
                      )}
                    </span>
                  </div>

                  {/* Company Description */}
                  <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {company.companyDescription ||
                      "Leading enterprise recruiting top engineering talent for technical roles and innovation."}
                  </p>

                  {/* Contact & Location Details */}
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-2">
                    {company.location && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{company.location}</span>
                      </div>
                    )}
                    {company.contactEmail && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-mono">{company.contactEmail}</span>
                      </div>
                    )}
                    {company.contactPhone && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{company.contactPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Pill & Website Link */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 border border-indigo-100">
                      <Briefcase className="h-3 w-3" />
                      <span>{driveCount} Drives Hosted</span>
                    </span>

                    {company.companyWebsite && (
                      <a
                        href={
                          company.companyWebsite.startsWith("http")
                            ? company.companyWebsite
                            : `https://${company.companyWebsite}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        <span>Visit Site</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  <button
                    onClick={() =>
                      onCreateDriveForCompany && onCreateDriveForCompany(company._id)
                    }
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Placement Drive</span>
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEdit(company)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Edit className="h-3.5 w-3.5 text-slate-500" />
                      <span>Edit Profile</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(company)}
                      title={isActive ? "Deactivate company" : "Reactivate company"}
                      className={`flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border border-rose-200 bg-rose-50/70 text-rose-600 hover:bg-rose-100"
                          : "border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{isActive ? "Deactivate" : "Activate"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT COMPANY MODAL */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingCompany ? "Edit Corporate Partner" : "Register Corporate Partner"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter organizational profile and recruiter contact credentials
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                  setEditingCompany(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitCompany} className="mt-6 space-y-4 text-xs">
              {/* Logo Upload & Preview */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Company Brand Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-slate-400" />
                    )}
                  </div>

                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Upload className="h-3.5 w-3.5 text-slate-500" />
                      <span>{logoPreview ? "Change Logo" : "Upload Brand Logo"}</span>
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      PNG, JPG, or SVG up to 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google, Microsoft, Adobe"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden font-medium"
                />
              </div>

              {/* Industry & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Industry Sector *
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  >
                    {COMMON_INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Headquarters / Office Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru, Karnataka"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Official Website
                </label>
                <input
                  type="text"
                  placeholder="https://company.com"
                  value={formData.companyWebsite}
                  onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              {/* Contact Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    HR / Recruiter Email
                  </label>
                  <input
                    type="email"
                    placeholder="university-recruiting@company.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Company Overview & Culture
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe the business model, culture, and what kind of students they are looking for..."
                  value={formData.companyDescription}
                  onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingCompany(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500 disabled:opacity-60 transition active:scale-95"
                >
                  {submitting
                    ? "Saving Company..."
                    : editingCompany
                    ? "Update Partner Details"
                    : "Register Corporate Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
