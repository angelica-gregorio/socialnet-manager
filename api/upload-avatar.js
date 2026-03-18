import { put } from '@vercel/blob';
import Busboy from 'busboy';

// Disable Vercel's default body parser so Busboy can read the raw stream
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return new Promise((resolve) => {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = '';
    let mimeType = '';

    // Listen for the file in the incoming form data
    busboy.on('file', (name, file, info) => {
      fileName = info.filename;
      mimeType = info.mimeType;
      
      const chunks = [];
      
      // Collect chunks of file data
      file.on('data', (data) => {
        chunks.push(data);
      });
      
      // When the file is fully read, combine chunks into a single Buffer
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    // When the entire request has been parsed
    busboy.on('finish', async () => {
      if (!fileBuffer) {
        res.status(400).json({ error: 'No file uploaded' });
        return resolve();
      }

      try {
        // Upload the file buffer to Vercel Blob
        const blob = await put(`avatars/${fileName}`, fileBuffer, {
          access: 'public', // Makes the image publicly viewable
          contentType: mimeType,
        });

        // Send the Vercel Blob response (including the new image URL) back to the browser
        res.status(200).json(blob);
        resolve();
      } catch (error) {
        console.error('Blob upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
        resolve();
      }
    });

    busboy.on('error', (error) => {
      console.error('Busboy error:', error);
      res.status(500).json({ error: 'Error parsing form data' });
      resolve();
    });

    // Pipe the raw request into Busboy to start processing
    req.pipe(busboy);
  });
}