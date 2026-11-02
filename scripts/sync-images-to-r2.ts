import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("Missing R2 environment variables in .env");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function uploadFile(filePath: string, key: string) {
  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  console.log(`  ✓ Uploaded: ${key}`);
}

async function sync() {
  console.log(`Starting image sync to R2 bucket "${bucketName}"...`);
  const productsDir = path.join(process.cwd(), "public", "products");
  const folders = fs.readdirSync(productsDir);

  let count = 0;
  for (const folder of folders) {
    const folderPath = path.join(productsDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const key = `products/${folder}/${file}`;
      await uploadFile(filePath, key);
      count++;
    }
  }

  // Also sync hero and branding assets
  const rootFiles = ["hero1.jpeg", "hero2.jpeg", "hero3.jpeg", "hero4.jpeg", "logo.png"];
  for (const rf of rootFiles) {
    const rfPath = path.join(process.cwd(), "public", rf);
    if (fs.existsSync(rfPath)) {
      await uploadFile(rfPath, rf);
      count++;
    }
  }

  console.log(`\n🎉 Success! Synced all ${count} images directly into your R2 bucket.`);
}

sync().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
