import { ApiError } from "../utils/ApiError.js";

export function ensureProfileEditable(profile, user) {
    if (
        profile.isProfileLocked &&
        profile.verificationStatus !== "REVERIFICATION_REQUESTED" &&
        user.role !== "admin"
    ) {
        throw new ApiError(403, "Profile is locked. Request TPO re-verification before editing academic records.");
    }
}
