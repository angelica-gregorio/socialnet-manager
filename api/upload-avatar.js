import busboy from 'busboy';
import sharp from 'sharp';
import { put } from '@vercel/blob';

// REQUIRED: Vercel must not pre-parse the body so busboy can read the raw stream.
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "10mb",
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Token missing.' });
  }

  return new Promise((resolve) => {
    const bb = busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = 'upload.webp';

    // Collect file stream into memory
    bb.on('file', (name, file, info) => {
      fileName = info.filename;
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on('finish', async () => {
      if (!fileBuffer) {
        res.status(400).json({ error: 'No file found in the upload.' });
        return resolve();
      }

      try {
        // Image processing using sharp (from section 6.3)
        const processedBuffer = await sharp(fileBuffer)
          .rotate()                        
          .resize(256, 256, {
            fit: "inside",                 
            withoutEnlargement: true,      
          })
          .webp({ quality: 80, effort: 6, alphaQuality: 80 })
          .toBuffer();                     

        // Create a safe filename with a timestamp to avoid caching issues
        const baseName = fileName.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
        const webpFilename = `${baseName}-${Date.now()}.webp`;

        // Upload to Vercel Blob
        const blob = await put(`avatars/${webpFilename}`, processedBuffer, {
          access: 'public',
          token: token
        });

        // Return the new URL back to the browser
        res.status(200).json({ url: blob.url });

      } catch (error) {
        res.status(500).json({ error: 'Image processing or upload failed: ' + error.message });
      }
      resolve();
    });

    bb.on('error', (error) => {
      res.status(500).json({ error: 'Error parsing form data: ' + error.message });
      resolve();
    });

    // Pipe the request stream into busboy
    req.pipe(bb);
  });
}