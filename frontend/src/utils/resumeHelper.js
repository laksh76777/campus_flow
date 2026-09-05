/**
 * Normalizes resume URLs for reliable, error-free viewing in browser tabs.
 *
 * Background:
 * Cloudinary accounts by default restrict public delivery of raw PDF files when uploaded
 * under the `/image/upload/` resource path, resulting in HTTP 401: "deny or ACL failure"
 * ("Failed to load PDF document").
 *
 * Cloudinary natively supports converting uploaded PDFs on-the-fly to image formats
 * (such as .png or .jpg) when requested under `/image/upload/`, returning HTTP 200 OK.
 *
 * If the URL is already a raw resource or external PDF link, it is returned untouched.
 */
export const getResumeViewUrl = (url) => {
  if (!url || typeof url !== "string") return "";

  // Cloudinary image upload pointing to .pdf
  if (
    url.includes("res.cloudinary.com") &&
    url.includes("/image/upload/") &&
    url.toLowerCase().endsWith(".pdf")
  ) {
    // Return high-resolution rendered image of the document
    return url.replace(/\.pdf$/i, ".png");
  }

  return url;
};
