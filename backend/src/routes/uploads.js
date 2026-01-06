import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Uploads directory - relative to backend folder
const UPLOADS_DIR = join(__dirname, '../../uploads');

// Ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('📁 Created uploads directory:', UPLOADS_DIR);
  }
}

// Initialize on module load
ensureUploadsDir();

// Upload image (accepts base64 data)
router.post('/image', authenticateToken, async (req, res) => {
  try {
    const { image, filename } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    // Parse base64 data URL
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL.' });
    }
    
    const extension = matches[1];
    const base64Data = matches[2];
    
    // Validate file type
    const allowedTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    if (!allowedTypes.includes(extension.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid image type. Allowed: ' + allowedTypes.join(', ') });
    }
    
    // Generate unique filename
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${uniqueId}.${extension}`;
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check file size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Maximum size is 5MB.' });
    }
    
    // Ensure uploads directory exists
    await ensureUploadsDir();
    
    // Save file
    const filepath = join(UPLOADS_DIR, safeFilename);
    await fs.writeFile(filepath, buffer);
    
    // Return URL path
    const imageUrl = `/uploads/${safeFilename}`;
    
    console.log(`📸 Image uploaded: ${safeFilename} by user ${req.user.id}`);
    
    res.json({
      success: true,
      url: imageUrl,
      filename: safeFilename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Delete image (admin or owner)
router.delete('/image/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = join(UPLOADS_DIR, filename);
    
    try {
      await fs.unlink(filepath);
      console.log(`🗑️ Image deleted: ${filename}`);
      res.json({ success: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;

