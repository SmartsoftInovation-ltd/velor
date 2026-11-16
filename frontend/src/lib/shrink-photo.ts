/**
 * Scales a picked photo down to fit `max` pixels on its longest side and
 * re-encodes it as JPEG, so a multi-megabyte phone photo goes up as a small
 * avatar. Browser only (canvas); throws when the file is not a readable image.
 */
export async function shrinkPhoto(file: Blob, max = 512, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))), "image/jpeg", quality),
  );
}
