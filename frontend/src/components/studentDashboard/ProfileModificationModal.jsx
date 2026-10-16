import { useState } from "react";
import {
  FileEdit,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Send,
  History,
  Info
} from "lucide-react";
import toast from "react-hot-toast";
import { requestProfileModification } from "../../services/studentService";

const MODIFIABLE_FIELDS = [
  { id: "activeBacklogs", label: "Active Backlogs (Arrears)", key: "activeBacklogs" },
  { id: "clearedBacklogsCount", label: "Cleared Backlogs Count", key: "clearedBacklogsCount" },
  { id: "cgpa", label: "College CGPA", key: "cgpa" },
  { id: "phone", label: "Mobile / Phone Number", key: "phone" },
  { id: "personalEmail", label: "Personal Email Address", key: "personalEmail" },
  { id: "tenthPercentage", label: "10th Standard Percentage", key: "tenthPercentage" },
  { id: "twelfthPercentage", label: "12th / Diploma Percentage", key: "twelfthPercentage" },
  { id: "semester", label: "Current Semester", key: "semester" },
  { id: "admissionYear", label: "Admission Year", key: "admissionYear" },
  { id: "graduationYear", label: "Graduation Year (Batch)", key: "graduationYear" },
  { id: "fatherName", label: "Father's Full Name", key: "fatherName" },
  { id: "motherName", label: "Mother's Full Name", key: "motherName" },
  { id: "parentPhone", label: "Parent Mobile Contact", key: "parentPhone" },
  { id: "other", label: "Other Academic or Personal Detail", key: "other" }
];

export default function ProfileModificationModal({
  isOpen,
  onClose,
  studentProfile = {},
  user = {},
  onRequestSubmitted
}) {
  const [selectedFieldId, setSelectedFieldId] = useState("activeBacklogs");
  const [customFieldLabel, setCustomFieldLabel] = useState("");
  const [afterValue, setAfterValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("new"); // "new" | "history"

  if (!isOpen) return null;

  // Resolve current 'Before' value based on selected field
  const getBeforeValue = (fieldId) => {
    switch (fieldId) {
      case "activeBacklogs":
        return String(studentProfile.activeBacklogs ?? studentProfile.backlogs ?? 0);
      case "clearedBacklogsCount":
        return String(studentProfile.clearedBacklogsCount ?? 0);
      case "cgpa":
        return String(studentProfile.verifiedCGPA ?? studentProfile.cgpa ?? "");
      case "phone":
        return String(user.phone || studentProfile.alternatePhone || "");
      case "personalEmail":
        return String(user.email || studentProfile.personalEmail || "");
      case "tenthPercentage":
        return String(studentProfile.tenthDetails?.percentage ?? studentProfile.tenthPercentage ?? "");
      case "twelfthPercentage":
        return String(studentProfile.twelfthOrDiplomaDetails?.percentage ?? studentProfile.twelfthPercentage ?? "");
      case "semester":
        return String(studentProfile.semester ?? studentProfile.currentSemester ?? "");
      case "admissionYear":
        return String(studentProfile.admissionYear ?? "");
      case "graduationYear":
        return String(studentProfile.graduationYear ?? "");
      case "fatherName":
        return String(studentProfile.family?.fatherName || "");
      case "motherName":
        return String(studentProfile.family?.motherName || "");
      case "parentPhone":
        return String(studentProfile.family?.fatherPhone || studentProfile.family?.parentPhone || "");
      default:
        return "Not specified";
    }
  };

  const selectedFieldObj = MODIFIABLE_FIELDS.find((f) => f.id === selectedFieldId) || MODIFIABLE_FIELDS[0];
  const beforeValue = getBeforeValue(selectedFieldId);
  const existingRequests = studentProfile.modificationRequests || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!afterValue.trim()) {
      toast.error("Please enter the requested new value");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide an official reason or justification for this modification");
      return;
    }

    setSubmitting(true);
    try {
      const fieldLabel = selectedFieldId === "other" && customFieldLabel.trim()
        ? customFieldLabel.trim()
        : selectedFieldObj.label;

      const payload = {
        reason: reason.trim(),
        changes: [
          {
            field: selectedFieldId,
            fieldLabel,
            beforeValue: beforeValue,
            afterValue: afterValue.trim()
          }
        ]
      };

      const res = await requestProfileModification(payload);
      toast.success("Modification request submitted to TPO Admin successfully!");
      if (onRequestSubmitted) {
        onRequestSubmitted(res?.data);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit modification request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-red-950 via-red-900 to-orange-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-orange-200 border border-white/20">
              <FileEdit className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white">
                Request TPO Profile Modification
              </h3>
              <p className="text-xs text-orange-200/90 font-medium">
                Official review & update workflow for locked academic records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 py-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === "new"
                ? "bg-white text-orange-950 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send className="h-3.5 w-3.5 text-orange-600" />
            <span>Submit New Request</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === "history"
                ? "bg-white text-orange-950 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>Past Requests ({existingRequests.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "new" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl bg-orange-50/70 border border-orange-200 p-3 text-xs text-orange-900 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-orange-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Your profile is locked. To modify fields such as <strong>Active Backlogs</strong> (e.g. from 1 to 0 after reval), CGPA, or mobile number, specify the requested change below. The TPO Administrator will review and approve it.
                </p>
              </div>

              {/* Field Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Field to Modify
                </label>
                <select
                  value={selectedFieldId}
                  onChange={(e) => {
                    setSelectedFieldId(e.target.value);
                    setAfterValue("");
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-800 bg-white outline-none focus:border-orange-600 shadow-2xs"
                >
                  {MODIFIABLE_FIELDS.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFieldId === "other" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Field Name
                  </label>
                  <input
                    type="text"
                    value={customFieldLabel}
                    onChange={(e) => setCustomFieldLabel(e.target.value)}
                    placeholder="e.g. Education Gap Reason or Permanent State"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-orange-600"
                  />
                </div>
              )}

              {/* Before vs After Side-by-Side Comparison Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Before (Current Value) */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                      Before (Current Recorded Value)
                    </span>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded">
                      Locked
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900 bg-white border border-rose-200 rounded-xl px-3 py-2 truncate">
                    {beforeValue || "—"}
                  </div>
                </div>

                {/* After (Requested New Value) */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      After (Requested New Value)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                      New Value
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={afterValue}
                    onChange={(e) => setAfterValue(e.target.value)}
                    placeholder={
                      selectedFieldId === "activeBacklogs"
                        ? "e.g. 0"
                        : selectedFieldId === "cgpa"
                        ? "e.g. 8.75"
                        : "Enter new value"
                    }
                    className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-extrabold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Justification / Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reason / Official Justification <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Cleared 3rd semester backlog in VTU re-evaluation (Grade sheet attached to academic profile or verified with department coordinator)"
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs font-medium text-slate-800 outline-none focus:border-orange-600 shadow-2xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The TPO administrator will review this explanation and accept or reject the change accordingly.
                </p>
              </div>

              {/* Form Action */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-900 to-orange-700 px-5 py-2 text-xs font-black text-white hover:from-red-950 hover:to-orange-800 transition disabled:opacity-50 shadow-md shadow-red-950/20 active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? "Submitting..." : "Send Modification Request"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* PAST REQUESTS HISTORY */
            <div className="space-y-3">
              {existingRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No modification requests submitted yet.
                </div>
              ) : (
                existingRequests.map((reqItem, idx) => (
                  <div
                    key={reqItem._id || idx}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">
                        {new Date(reqItem.requestedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          reqItem.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : reqItem.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border-rose-300"
                            : "bg-amber-50 text-amber-700 border-amber-300"
                        }`}
                      >
                        {reqItem.status}
                      </span>
                    </div>

                    {/* Changes list */}
                    <div className="space-y-1.5">
                      {(reqItem.changes || []).map((ch, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200"
                        >
                          <span className="font-bold text-slate-700">{ch.fieldLabel || ch.field}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-rose-600 line-through font-bold">
                              {ch.beforeValue || "none"}
                            </span>
                            <ArrowRight className="h-3 w-3 text-slate-400" />
                            <span className="text-emerald-700 font-extrabold">{ch.afterValue}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reason */}
                    <div className="text-xs text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700">Reason: </span>
                      {reqItem.reason}
                    </div>

                    {/* TPO Remarks if reviewed */}
                    {reqItem.reviewRemarks && (
                      <div className="text-xs text-orange-900 bg-orange-50 p-2 rounded-lg border border-orange-200">
                        <span className="font-bold">TPO Admin Remarks: </span>
                        {reqItem.reviewRemarks}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
