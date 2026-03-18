export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing image URL parameter' });
  }

  try {
    // 1. Fetch the private image directly using your secure token
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch image from Vercel');

    // 2. Tell the browser what kind of file this is (e.g., image/webp)
    res.setHeader('Content-Type', response.headers.get('content-type'));
    
    // Cache the image in the browser so it doesn't download every time
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // 3. Convert the image data to a buffer and send it to the HTML <img> tag
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error('[get-avatar] Error:', error);
    res.status(500).json({ error: 'Failed to load private image' });
  }
}