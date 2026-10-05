/** A stored file the browser can show: a web, blob or inline-image URL (a bare storage key is not one). */
export function isPhotoUrl(fileUrl: string): boolean {
  return /^(?:https?:|blob:|data:image\/)/i.test(fileUrl);
}
