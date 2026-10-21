/**
 * Browser-side: scales a photo down before upload so phones on mobile data upload ~100 KB,
 * not a 5 MB camera file. PNGs (logos with transparency) stay PNG; everything else becomes JPEG.
 */
export async function shrinkImage(file: File, maxSide: number): Promise<File> {
  if (!/^image\//.test(file.type)) throw new Error("Pick an image file (JPG, PNG or WebP).");
  if (file.size > 20_000_000) throw new Error("That photo is over 20 MB. Pick a smaller one.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that image. Try another file.");
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d")!;
  const png = file.type === "image/png";
  if (!png) {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.82));
  let blob = await encode(png ? "image/png" : "image/jpeg");
  // A photo-like PNG can stay big even when small in pixels; JPEG keeps it under the upload limit.
  if (blob && blob.type === "image/png" && blob.size > 700_000) {
    g.globalCompositeOperation = "destination-over";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    blob = await encode("image/jpeg");
  }
  if (!blob) throw new Error("Couldn't prepare that image. Try another file.");
  const jpeg = blob.type === "image/jpeg";
  return new File([blob], `photo.${jpeg ? "jpg" : "png"}`, { type: jpeg ? "image/jpeg" : "image/png" });
}
