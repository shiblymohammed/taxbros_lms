import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * Upload Service
 * 
 * Handles file uploads with validation and image processing
 * 
 * Requirements:
 * - R15.3: Validate file size max 2MB
 * - R15.4: Automatically resize images wider than 1200px
 * - R15.5: Store images in /uploads/{year}/{month}/{filename}
 * - R15.7: Support file deletion
 */
@Injectable()
export class UploadService {
  private readonly uploadBasePath = join(process.cwd(), 'uploads');
  private readonly maxFileSizeMB = 2;
  private readonly maxFileSizeBytes = this.maxFileSizeMB * 1024 * 1024;
  private readonly maxImageWidth = 1200;
  private readonly allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  /**
   * Upload and process a course cover image
   * 
   * Requirements:
   * - R15.3: Validate file size does not exceed 2MB
   * - R15.4: Resize images wider than 1200px
   * - R15.5: Store images in /uploads/{year}/{month}/{filename}
   * 
   * @param file - Uploaded file from multer
   * @returns Relative file path for database storage
   */
  async uploadCourseCover(file: Express.Multer.File): Promise<string> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size
    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `File size exceeds ${this.maxFileSizeMB}MB limit`
      );
    }

    // Validate file type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed types: jpg, png, webp'
      );
    }

    // Generate storage path: /uploads/{year}/{month}
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const uploadDir = join(this.uploadBasePath, year, month);

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = this.getFileExtension(file.originalname);
    const filename = `course-cover-${timestamp}-${randomStr}${extension}`;
    const filePath = join(uploadDir, filename);

    // Process and save image
    let imageBuffer = file.buffer;

    // Use sharp to check dimensions and resize if needed
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (metadata.width && metadata.width > this.maxImageWidth) {
      // Resize image to max width while maintaining aspect ratio
      imageBuffer = await image
        .resize(this.maxImageWidth, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();
    }

    // Save processed image
    await fs.writeFile(filePath, imageBuffer);

    // Return relative path for database storage
    const relativePath = `/uploads/${year}/${month}/${filename}`;
    return relativePath;
  }

  /**
   * Delete a course cover image
   * 
   * Requirements:
   * - R15.7: Remove file from storage when deleted
   * 
   * @param imagePath - Relative path from database (e.g., /uploads/2024/01/filename.jpg)
   */
  async deleteCourseCover(imagePath: string): Promise<void> {
    if (!imagePath) {
      return;
    }

    try {
      // Convert relative path to absolute path
      const fullPath = join(process.cwd(), imagePath.replace(/^\//, ''));
      
      // Check if file exists and delete
      await fs.access(fullPath);
      await fs.unlink(fullPath);
    } catch (error) {
      // Silently fail if file doesn't exist
      // This handles cases where DB record exists but file was already deleted
      console.warn(`Failed to delete file ${imagePath}:`, error.message);
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '.jpg'; // Default extension
    return filename.substring(lastDot);
  }
}
