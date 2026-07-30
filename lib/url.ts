// Participants type links by hand, and most of them leave off the scheme
// ("hi.com", "github.com/foo"). A bare value in an href is treated as a
// *relative* path, so the browser resolves it against the current page and
// you end up at /admin/hi.com instead of the site they meant. Normalising to
// an absolute URL keeps every submitted link opening as-is.
export function externalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const url = raw.trim()
  if (!url) return null

  // Already absolute (http://, https://, mailto:, etc.) — leave it alone,
  // except for the scheme-relative "//example.com" form.
  if (/^\/\//.test(url)) return `https:${url}`
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    // Block scripting schemes — these would run in the admin's session.
    if (/^(javascript|data|vbscript):/i.test(url)) return null
    return url
  }

  return `https://${url}`
}
