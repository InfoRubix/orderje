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
  const type = png ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.82));
  if (!blob) throw new Error("Couldn't prepare that image. Try another file.");
  return new File([blob], `photo.${png ? "png" : "jpg"}`, { type });
}
