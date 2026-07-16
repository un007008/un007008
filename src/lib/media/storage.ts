import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Storage abstraction: Cloudflare R2 when configured, local ./public/uploads
 * fallback for dev so the app works without credentials.
 */

function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } =
    process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    return null;
  }
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
    bucket: R2_BUCKET_NAME,
    publicUrl: R2_PUBLIC_URL.replace(/\/$/, ""),
  };
}

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

/** Store a file; returns its public URL. key example: "properties/abc-1.webp" */
export async function storeFile(key: string, data: Buffer, contentType: string): Promise<string> {
  const r2 = r2Config();
  if (r2) {
    await r2.client.send(
      new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: data, ContentType: contentType })
    );
    return `${r2.publicUrl}/${key}`;
  }
  if (process.env.NODE_ENV === "production") {
    // still works (served via /uploads route), but files die with the container
    console.warn(
      "[storage] R2 is not configured — storing uploads on local disk. " +
        "Files will be lost on redeploy unless a volume is mounted at public/uploads."
    );
  }
  const filePath = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  return `/uploads/${key}`;
}

export async function deleteFile(url: string): Promise<void> {
  const r2 = r2Config();
  try {
    if (r2 && url.startsWith(r2.publicUrl)) {
      const key = url.slice(r2.publicUrl.length + 1);
      await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
    } else if (url.startsWith("/uploads/")) {
      await unlink(path.join(process.cwd(), "public", url));
    }
  } catch (error) {
    console.error("deleteFile failed:", error);
  }
}
