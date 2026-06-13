# File Upload & Processing API

A RESTful backend API for uploading and processing files built with 
Node.js, Express, and PostgreSQL. Supports image resizing and PDF 
text extraction with background job processing via BullMQ.

## Live URL
https://file-upload-api-k981.onrender.com

## Features
- JWT authentication with access and refresh tokens
- Image uploads with automatic resizing via Sharp
- PDF uploads with automatic text extraction via pdfjs-dist
- Cloud storage on Cloudinary
- Background job processing with BullMQ and Redis
- Non-blocking uploads — API responds instantly while files process
- File metadata and extracted text stored in PostgreSQL
- Processing status tracking (processing/done/failed)

## Tech Stack
- Node.js
- Express.js
- PostgreSQL (Supabase)
- Cloudinary (cloud file storage)
- BullMQ (background job queue)
- Redis / Upstash (job queue storage)
- Sharp (image processing)
- pdfjs-dist (PDF text extraction)
- JSON Web Tokens (JWT)
- bcrypt

## Database Schema
users
  - id, email, password, created_at

files
  - id, user_id (FK), original_name, file_type
  - cloudinary_url, extracted_text
  - status (processing/done/failed), created_at

refresh_tokens
  - id, user_id (FK), token, created_at

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /auth/signup | Register a new user | No |
| POST | /auth/login | Login and get tokens | No |
| GET | /auth/profile | Get current user | Yes |

### Files
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /upload | Upload image or PDF | Yes |
| GET | /files | Get all your files | Yes |
| GET | /files/:id | Get single file + extracted text | Yes |
| DELETE | /files/:id | Delete a file | Yes |

## Getting Started

### Prerequisites
- Node.js
- PostgreSQL database (Supabase)
- Cloudinary account
- Redis instance (Upstash)

### Installation
1. Clone the repo
   git clone https://github.com/Prince-Gulia/file-upload-api

2. Install dependencies
   npm install

3. Create .env file
   DATABASE_URL=your_supabase_connection_string
   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_jwt_refresh_secret
   ACCESS_TOKEN_EXPIRY=15m
   REFRESH_TOKEN_EXPIRY=7d
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   REDIS_URL=your_upstash_redis_url

4. Run the server
   npm run dev

## How File Processing Works
1. User uploads file via POST /upload
2. API saves record to DB with status 'processing'
3. Job added to Redis queue via BullMQ
4. API responds instantly with fileId
5. BullMQ worker picks up job in background
6. Image: resized to 800x800 JPEG via Sharp
   PDF: text extracted page by page via pdfjs-dist
7. Processed file uploaded to Cloudinary
8. DB updated with cloudinary URL and status 'done'

## File Support
- Images: JPEG, PNG, WEBP (auto-resized to 800x800)
- PDFs: text extracted and stored for querying
- Max file size: 10MB

## Authorization
Protected routes require a Bearer token in the Authorization header:
   Authorization: Bearer your_access_token
