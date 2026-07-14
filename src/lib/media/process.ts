import sharp from "sharp";

/** Convert an uploaded image to web-ready WebP + thumbnail. */
export async function processImage(input: Buffer) {
  const image = sharp(input, { failOn: "none" }).rotate(); // respect EXIF orientation

  const full = await image
    .clone()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumb = await image
    .clone()
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  return { full, thumb };
}
