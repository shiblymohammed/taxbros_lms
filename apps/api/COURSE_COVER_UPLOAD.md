# Course Cover Image Upload - Task 27 Implementation

## Overview

Task 27 implements file upload functionality for course cover images with validation, automatic resizing, and proper storage management.

## Requirements Implemented

- **R15.3**: Validate file size max 2MB
- **R15.4**: Automatically resize images wider than 1200px
- **R15.5**: Store images in `/uploads/{year}/{month}/{filename}`
- **R15.6**: Update course record with image URL
- **R15.7**: Support file deletion

## API Endpoints

### Upload Course Cover Image

**Endpoint:** `POST /api/upload/course-cover/:courseId`

**Authentication:** Required (JWT Bearer Token)

**Authorization:** ADMINISTRATOR or SUPER_ADMIN role only

**Content-Type:** `multipart/form-data`

**Request:**
```
POST /api/upload/course-cover/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image file>
```

**Field Name:** `file`

**Accepted File Types:**
- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `image/webp` (.webp)

**File Size Limit:** 2 MB

**Response (200 OK):**
```json
{
  "message": "Course cover image uploaded successfully",
  "coverImage": "/uploads/2026/11/course-cover-1700472123456-abc123.jpg",
  "course": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Introduction to Tax Filing",
    "description": "Learn the basics...",
    "coverImage": "/uploads/2026/11/course-cover-1700472123456-abc123.jpg",
    "status": "DRAFT",
    "createdAt": "2026-11-19T10:00:00.000Z",
    "updatedAt": "2026-11-19T10:30:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request` - No file provided
  ```json
  {
    "statusCode": 400,
    "message": "No file uploaded"
  }
  ```

- `400 Bad Request` - File too large
  ```json
  {
    "statusCode": 400,
    "message": "File size exceeds 2MB limit"
  }
  ```

- `400 Bad Request` - Invalid file type
  ```json
  {
    "statusCode": 400,
    "message": "Invalid file type. Allowed types: jpg, png, webp"
  }
  ```

- `400 Bad Request` - Course not found
  ```json
  {
    "statusCode": 400,
    "message": "Course not found"
  }
  ```

- `403 Forbidden` - Insufficient permissions
  ```json
  {
    "statusCode": 403,
    "message": "Forbidden resource"
  }
  ```

### Delete Course Cover Image

**Endpoint:** `DELETE /api/upload/course-cover/:courseId`

**Authentication:** Required (JWT Bearer Token)

**Authorization:** ADMINISTRATOR or SUPER_ADMIN role only

**Request:**
```
DELETE /api/upload/course-cover/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Course cover image deleted successfully"
}
```

**Response when no image exists (200 OK):**
```json
{
  "message": "No cover image to delete"
}
```

**Error Responses:**

- `400 Bad Request` - Course not found
  ```json
  {
    "statusCode": 400,
    "message": "Course not found"
  }
  ```

- `403 Forbidden` - Insufficient permissions
  ```json
  {
    "statusCode": 403,
    "message": "Forbidden resource"
  }
  ```

## Features

### 1. File Validation

The upload service validates:
- **File presence**: Ensures a file is provided in the request
- **File size**: Rejects files larger than 2MB
- **File type**: Only accepts JPEG, PNG, and WebP images
- **Course existence**: Verifies the course exists before upload

### 2. Image Processing

**Automatic Resizing:**
- Images wider than 1200px are automatically resized
- Maintains aspect ratio during resize
- Uses high-quality compression
- Powered by the `sharp` library for fast, efficient processing

**Example:**
- Original image: 2000×1500 pixels
- Resized to: 1200×900 pixels (maintaining 4:3 ratio)

### 3. Storage Structure

Images are stored in a date-based directory structure:

```
uploads/
├── 2026/
│   ├── 11/
│   │   ├── course-cover-1700472123456-abc123.jpg
│   │   ├── course-cover-1700472234567-def456.png
│   │   └── course-cover-1700472345678-ghi789.webp
│   └── 12/
│       └── course-cover-1700472456789-jkl012.jpg
```

**Filename Format:** `course-cover-{timestamp}-{random}.{extension}`

**Benefits:**
- Organized by year and month for easy management
- Prevents filename collisions with timestamp + random string
- Maintains original file extension for compatibility
- Easy to implement retention policies (e.g., archive old months)

### 4. Database Integration

The system automatically:
- Updates the `Course.coverImage` field with the relative path
- Deletes old cover images when a new one is uploaded
- Clears the database reference when an image is deleted
- Maintains referential integrity

### 5. Static File Serving

Uploaded images are accessible via HTTP:

```
http://localhost:3001/uploads/2026/11/course-cover-1700472123456-abc123.jpg
```

The `main.ts` configuration serves files from the `uploads/` directory with the `/uploads/` URL prefix.

## Implementation Details

### Dependencies Added

```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1",
    "@types/multer": "^1.4.12",
    "sharp": "^0.35.5"
  }
}
```

### New Files Created

1. **`src/upload/upload.service.ts`**
   - Handles file validation, image processing, and storage
   - Implements resizing logic using sharp
   - Manages file system operations

2. **`src/upload/upload.controller.ts`**
   - Exposes REST API endpoints
   - Handles multipart/form-data requests
   - Enforces authorization

3. **`src/upload/upload.module.ts`**
   - Configures Multer for file uploads
   - Integrates with CoursesModule
   - Exports UploadService for reuse

### Modified Files

1. **`src/app.module.ts`**
   - Added UploadModule import

2. **`src/main.ts`**
   - Added static file serving configuration
   - Imported NestExpressApplication type

3. **`src/courses/dto/update-course.dto.ts`**
   - Added `coverImage` field to support image URL updates

## Testing

### E2E Test Suite

A comprehensive test suite has been created at:
`test/course-cover-upload.e2e-spec.ts`

**Test Coverage:**

1. **Upload Tests:**
   - ✓ Upload course cover successfully
   - ✓ Resize images wider than 1200px
   - ✓ Reject files larger than 2MB
   - ✓ Reject invalid file types
   - ✓ Reject upload without file
   - ✓ Reject upload for non-existent course
   - ✓ Deny access to students
   - ✓ Replace existing cover image

2. **Delete Tests:**
   - ✓ Delete course cover successfully
   - ✓ Handle deletion when no cover exists
   - ✓ Deny access to students
   - ✓ Reject deletion for non-existent course

### Manual Testing with cURL

**Upload Example:**
```bash
# Login as admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@taxbros.com","password":"Admin123!"}'

# Extract token from response
export TOKEN="<access_token>"

# Upload cover image
curl -X POST http://localhost:3001/api/upload/course-cover/<courseId> \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.jpg"
```

**Delete Example:**
```bash
curl -X DELETE http://localhost:3001/api/upload/course-cover/<courseId> \
  -H "Authorization: Bearer $TOKEN"
```

### Testing with Postman/Insomnia

1. **Create a new POST request**
   - URL: `http://localhost:3001/api/upload/course-cover/:courseId`
   - Method: POST
   - Authorization: Bearer Token (use admin access token)
   - Body: form-data
     - Key: `file` (type: File)
     - Value: Select an image file

2. **Create a new DELETE request**
   - URL: `http://localhost:3001/api/upload/course-cover/:courseId`
   - Method: DELETE
   - Authorization: Bearer Token (use admin access token)

## Usage Examples

### Frontend Integration (React/Next.js)

```typescript
// Upload course cover
async function uploadCourseCover(courseId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `http://localhost:3001/api/upload/course-cover/${courseId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Delete course cover
async function deleteCourseCover(courseId: string) {
  const response = await fetch(
    `http://localhost:3001/api/upload/course-cover/${courseId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Usage in component
function CourseEditor({ courseId }) {
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size client-side
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    try {
      const result = await uploadCourseCover(courseId, file);
      console.log('Upload successful:', result.coverImage);
      // Update UI with new cover image
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error.message);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
      />
    </div>
  );
}
```

## Security Considerations

1. **Authentication Required**: All endpoints require valid JWT token
2. **Role-Based Access**: Only administrators can upload/delete images
3. **File Type Validation**: Only image formats are accepted
4. **File Size Limit**: 2MB maximum enforced at both Multer and service layers
5. **Path Traversal Prevention**: Filenames are generated server-side
6. **Input Validation**: Course ID validated before file operations

## Performance Considerations

1. **Memory Efficient**: Uses stream-based processing with sharp
2. **Automatic Cleanup**: Old images deleted when replaced
3. **Optimized Storage**: Images resized to reduce disk usage
4. **Fast Processing**: Sharp library uses libvips for high performance

## Future Enhancements

Potential improvements for future iterations:

1. **Cloud Storage**: Integrate AWS S3, Google Cloud Storage, or Azure Blob Storage
2. **Image Optimization**: Additional compression for different quality tiers
3. **Multiple Sizes**: Generate thumbnail and preview sizes automatically
4. **Progress Tracking**: Upload progress indication for large files
5. **Image Cropping**: Allow administrators to crop images before upload
6. **Bulk Upload**: Support multiple course cover uploads
7. **CDN Integration**: Serve images through CDN for better performance
8. **Image Metadata**: Extract and store EXIF data
9. **Watermarking**: Add institute logo/watermark to images
10. **Retention Policy**: Automatic cleanup of unused images

## Maintenance

### Disk Space Management

Monitor the `uploads/` directory size periodically:

```bash
# Check uploads directory size
du -sh uploads/

# List largest files
find uploads/ -type f -exec du -h {} + | sort -rh | head -20
```

### Backup Strategy

Include the `uploads/` directory in your backup strategy:

```bash
# Example backup script
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

### Cleanup Old Files

Remove orphaned images (images not referenced in database):

```sql
-- Find courses with cover images
SELECT "coverImage" FROM courses WHERE "coverImage" IS NOT NULL;

-- Compare with files in uploads/ directory
-- Delete files not in the result set
```

## Troubleshooting

### Common Issues

**Issue: "File size exceeds 2MB limit"**
- Solution: Resize or compress the image before upload

**Issue: "Invalid file type"**
- Solution: Ensure file is JPEG, PNG, or WebP format

**Issue: "Course not found"**
- Solution: Verify the course ID exists in the database

**Issue: Upload fails silently**
- Solution: Check server logs for detailed error messages
- Verify `uploads/` directory has write permissions

**Issue: Images not displaying**
- Solution: Verify static file serving is configured in `main.ts`
- Check file exists at the specified path

## Documentation

Full API documentation available at:
`http://localhost:3001/api/docs#/Uploads`

The Swagger UI provides:
- Interactive API testing
- Request/response schemas
- Authorization setup
- Example requests

## Conclusion

Task 27 successfully implements a complete file upload solution for course cover images with:
- ✅ Comprehensive validation (file size, type, authorization)
- ✅ Automatic image resizing for optimization
- ✅ Organized date-based storage structure
- ✅ Database integration and referential integrity
- ✅ Clean API design following REST principles
- ✅ Full test coverage (E2E tests)
- ✅ Production-ready error handling
- ✅ Swagger documentation

The implementation follows NestJS best practices and integrates seamlessly with the existing course management system.
