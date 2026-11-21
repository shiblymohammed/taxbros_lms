import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * Unit tests for UploadService
 * 
 * Validates:
 * - File validation (size, type)
 * - Image resizing logic
 * - File path generation
 * - Error handling
 */
describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadService],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  afterEach(async () => {
    // Clean up test uploads
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  describe('uploadCourseCover', () => {
    it('should throw error when no file provided', async () => {
      await expect(service.uploadCourseCover(null as any)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.uploadCourseCover(null as any)).rejects.toThrow(
        'No file provided'
      );
    });

    it('should throw error when file size exceeds 2MB', async () => {
      const largeBuffer = Buffer.alloc(3 * 1024 * 1024); // 3MB
      const mockFile = {
        buffer: largeBuffer,
        size: largeBuffer.length,
        mimetype: 'image/jpeg',
        originalname: 'large.jpg',
      } as Express.Multer.File;

      await expect(service.uploadCourseCover(mockFile)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.uploadCourseCover(mockFile)).rejects.toThrow(
        'File size exceeds 2MB limit'
      );
    });

    it('should throw error for invalid file type', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        size: 100,
        mimetype: 'text/plain',
        originalname: 'test.txt',
      } as Express.Multer.File;

      await expect(service.uploadCourseCover(mockFile)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.uploadCourseCover(mockFile)).rejects.toThrow(
        'Invalid file type'
      );
    });

    it('should accept jpeg files', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile = {
        buffer: imageBuffer,
        size: imageBuffer.length,
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
      } as Express.Multer.File;

      const result = await service.uploadCourseCover(mockFile);
      expect(result).toMatch(/^\/uploads\/\d{4}\/\d{2}\//);
      expect(result).toContain('course-cover-');
      expect(result).toMatch(/\.(jpg|jpeg)$/);
    });

    it('should accept png files', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .png()
        .toBuffer();

      const mockFile = {
        buffer: imageBuffer,
        size: imageBuffer.length,
        mimetype: 'image/png',
        originalname: 'test.png',
      } as Express.Multer.File;

      const result = await service.uploadCourseCover(mockFile);
      expect(result).toMatch(/^\/uploads\/\d{4}\/\d{2}\//);
      expect(result).toContain('course-cover-');
      expect(result).toMatch(/\.png$/);
    });

    it('should accept webp files', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .webp()
        .toBuffer();

      const mockFile = {
        buffer: imageBuffer,
        size: imageBuffer.length,
        mimetype: 'image/webp',
        originalname: 'test.webp',
      } as Express.Multer.File;

      const result = await service.uploadCourseCover(mockFile);
      expect(result).toMatch(/^\/uploads\/\d{4}\/\d{2}\//);
      expect(result).toContain('course-cover-');
      expect(result).toMatch(/\.webp$/);
    });

    it('should resize images wider than 1200px', async () => {
      // Create a 1600x1200 image
      const largeImageBuffer = await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: { r: 200, g: 100, b: 150 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile = {
        buffer: largeImageBuffer,
        size: largeImageBuffer.length,
        mimetype: 'image/jpeg',
        originalname: 'large.jpg',
      } as Express.Multer.File;

      const relativePath = await service.uploadCourseCover(mockFile);

      // Verify file was created
      const fullPath = join(process.cwd(), relativePath.replace(/^\//, ''));
      const fileExists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify image was resized
      const metadata = await sharp(fullPath).metadata();
      expect(metadata.width).toBeLessThanOrEqual(1200);
      expect(metadata.height).toBeLessThanOrEqual(900); // Maintains aspect ratio
    });

    it('should not resize images narrower than 1200px', async () => {
      // Create an 800x600 image
      const smallImageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile = {
        buffer: smallImageBuffer,
        size: smallImageBuffer.length,
        mimetype: 'image/jpeg',
        originalname: 'small.jpg',
      } as Express.Multer.File;

      const relativePath = await service.uploadCourseCover(mockFile);

      // Verify file was created
      const fullPath = join(process.cwd(), relativePath.replace(/^\//, ''));
      const metadata = await sharp(fullPath).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
    });

    it('should create date-based directory structure', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile = {
        buffer: imageBuffer,
        size: imageBuffer.length,
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
      } as Express.Multer.File;

      const relativePath = await service.uploadCourseCover(mockFile);

      // Verify path structure
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      expect(relativePath).toContain(`/uploads/${year}/${month}/`);
    });

    it('should generate unique filenames', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile = {
        buffer: imageBuffer,
        size: imageBuffer.length,
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
      } as Express.Multer.File;

      const path1 = await service.uploadCourseCover(mockFile);
      const path2 = await service.uploadCourseCover(mockFile);

      expect(path1).not.toBe(path2);
    });
  });

  describe('deleteCourseCover', () => {
    it('should not throw error when file does not exist', async () => {
      await expect(
        service.deleteCourseCover('/uploads/2024/01/nonexistent.jpg')
      ).resolves.not.toThrow();
    });

    it('should delete existing file', async () => {
      // First upload a file
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile = {
        buffer: imageBuffer,
        size: imageBuffer.length,
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
      } as Express.Multer.File;

      const relativePath = await service.uploadCourseCover(mockFile);

      // Verify file exists
      const fullPath = join(process.cwd(), relativePath.replace(/^\//, ''));
      let fileExists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Delete the file
      await service.deleteCourseCover(relativePath);

      // Verify file was deleted
      fileExists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should handle null/empty path gracefully', async () => {
      await expect(service.deleteCourseCover(null as any)).resolves.not.toThrow();
      await expect(service.deleteCourseCover('')).resolves.not.toThrow();
      await expect(service.deleteCourseCover(undefined as any)).resolves.not.toThrow();
    });
  });
});
