import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!token) {
  console.error("Error: BLOB_READ_WRITE_TOKEN is not set in your terminal.");
  process.exit(1);
}

const imagesDir = path.join(process.cwd(), 'resources', 'images');

async function processAndUpload() {
  try {
    const files = fs.readdirSync(imagesDir);
    const imageFiles = files.filter(file => file.match(/\.(png|jpg|jpeg)$/i));

    if (imageFiles.length === 0) {
      console.log("No images found in resources/images/");
      return;
    }

    console.log("File | Original (KB) | Compressed (KB) | Blob URL");
    console.log("-------------------------------------------------------");

    let sqlStatements = "-- Generated SQL UPDATE statements:\n";

    for (const file of imageFiles) {
      const filePath = path.join(imagesDir, file);
      const originalBuffer = fs.readFileSync(filePath);
      const originalSizeKB = (originalBuffer.length / 1024).toFixed(2);

      const baseName = file.split('.')[0];
      const webpFilename = baseName.toLowerCase().replace(/ /g, '_') + '.webp';

      const compressedBuffer = await sharp(originalBuffer)
        .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      
      const compressedSizeKB = (compressedBuffer.length / 1024).toFixed(2);

      const blob = await put(`avatars/${webpFilename}`, compressedBuffer, {
        access: 'public',
        token: token
      });

      console.log(`${file} | ${originalSizeKB} | ${compressedSizeKB} | ${blob.url}`);

      sqlStatements += `UPDATE profiles SET picture = '${blob.url}' WHERE picture LIKE '%${file}';\n`;
    }

    console.log("\n================ SQL STATEMENTS ================\n");
    console.log(sqlStatements);

  } catch (error) {
    console.error("An error occurred during the upload process:", error);
  }
}

processAndUpload();