/** Checklist 10: a photo leaves the dashboard at the size the cardápio shows it — a phone's 3000 px, 4 MB picture of a
 *  dish used to be stored and served as is. Scaled down to `maxSide` and re-encoded (JPEG 82%; PNG for a logo that has
 *  transparency), which also drops the camera's EXIF (location included). What can't be decoded goes as it came, and
 *  the API judges it as before. */
export async function shrinkImage(file: File, maxSide: number, keepTransparency = false): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
    const g = canvas.getContext("2d")!;
    const png = keepTransparency && file.type === "image/png";
    if (!png) {
      g.fillStyle = "#fff"; // JPEG has no transparency: what was see-through becomes white, not black
      g.fillRect(0, 0, canvas.width, canvas.height);
    }
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, png ? "image/png" : "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file; // already small: keep it
    return new File([blob], file.name.replace(/\.\w+$/, "") + (png ? ".png" : ".jpg"), { type: blob.type });
  } catch {
    return file;
  }
}
