# Audio Transcription API

A production-oriented NestJS + TypeScript API for asynchronous audio transcription with segment-level timestamps.

## Features

* MP3, WAV
* OpenAI speech-to-text
* Segment-level timestamps
* BullMQ + Redis asynchronous processing
* PostgreSQL persistence with Prisma
* Automatic retries with exponential backoff
* File type and size validation
* Job status API
* Swagger/OpenAPI documentation
* Docker Compose support

## Architecture

```text
Client
  |
  | POST /api/v1/transcriptions
  v
NestJS API
  |
  +--> Validate audio
  |
  +--> Create job
  |
  +--> BullMQ / Redis
          |
          v
     Transcription Worker
          |
          v
     OpenAI API
          |
          v
       PostgreSQL
          |
          v
GET /api/v1/transcriptions/:id
```

## Tech Stack

* Node.js
* NestJS
* TypeScript
* OpenAI API
* BullMQ
* Redis
* PostgreSQL
* Prisma
* Docker

## Requirements

* Node.js 20+
* npm
* Docker & Docker Compose
* OpenAI API key

## Installation

```bash
git clone <your-repository-url>
cd audio-transcription-api
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Set your OpenAI API key:

```env
OPENAI_API_KEY=your_openai_api_key
```

## Start Infrastructure

```bash
docker compose up -d postgres redis
```

Generate Prisma client:

```bash
npx prisma generate
```

Run database migration:

```bash
npx prisma migrate dev --name init
```

Start the API:

```bash
npm run start:dev
```

API:

```text
http://localhost:3000
```

Swagger:

```text
http://localhost:3000/docs
```

## API

### Upload Audio

```http
POST /api/v1/transcriptions
Content-Type: multipart/form-data
```

Example:

```bash
curl -X POST \
  http://localhost:3000/api/v1/transcriptions \
  -F "file=@sample.mp3"
```

Response:

```json
{
  "jobId": "8c8c4f2c-6a4b-4a1d-9e20-7e6b8e4c1234",
  "status": "queued"
}
```

The API returns immediately while the transcription is processed asynchronously.

### Get Transcription

```http
GET /api/v1/transcriptions/:jobId
```

Example:

```bash
curl \
  http://localhost:3000/api/v1/transcriptions/8c8c4f2c-6a4b-4a1d-9e20-7e6b8e4c1234
```

Example completed response:

```json
{
  "id": "8c8c4f2c-6a4b-4a1d-9e20-7e6b8e4c1234",
  "originalName": "sample.mp3",
  "mimeType": "audio/mpeg",
  "fileSize": 483920,
  "status": "COMPLETED",
  "language": "en",
  "fullText": "Hello, welcome to the meeting.",
  "segments": [
    {
      "start": 0,
      "end": 3.4,
      "text": "Hello, welcome to the meeting."
    }
  ]
}
```

## Processing Flow

1. Client uploads audio.
2. NestJS validates the file.
3. A transcription job is created.
4. BullMQ adds the job to Redis.
5. A worker processes the job.
6. Audio is sent to OpenAI.
7. Transcript and timestamps are stored in PostgreSQL.
8. Client retrieves the result using the job ID.

## Retry Handling

Temporary transcription failures are automatically retried using BullMQ with exponential backoff.

```text
Attempt 1
   |
   X
   |
 Retry
   |
Attempt 2
   |
   X
   |
 Retry
   |
Attempt 3
   |
   X
   |
 FAILED
```

Failed jobs retain the error information for investigation or reprocessing.

## Database

### `transcription_jobs`

Stores:

* Job ID
* Filename
* MIME type
* File size
* Status
* Language
* Full transcript
* Error message
* Created/completed timestamps

### `transcription_segments`

Stores:

* Job ID
* Start timestamp
* End timestamp
* Text

## Supported Audio Formats

The API supports:

* MP3
* WAV

For a larger production system, FFmpeg can be added to normalize incoming audio formats before transcription.

## Production Architecture

For high-volume workloads, audio should be stored in S3 or Azure Blob Storage rather than passing large audio buffers through Redis.

```text
Client
   |
   v
NestJS API
   |
   +----> S3 / Azure Blob Storage
   |
   +----> BullMQ / Redis
              |
              v
        Multiple Workers
              |
              v
          OpenAI API
              |
              v
          PostgreSQL
```

The queue should contain the storage key instead of the actual audio data.

This allows:

* Horizontal worker scaling
* Large file support
* Lower Redis memory usage
* Better fault tolerance
* Independent API/worker scaling
* Reliable retries

## Environment Variables

| Variable               | Description           | Example            |
| ---------------------- | --------------------- | ------------------ |
| `PORT`                 | API port              | `3000`             |
| `OPENAI_API_KEY`       | OpenAI API key        | `your_key`         |
| `DATABASE_URL`         | PostgreSQL connection | `postgresql://...` |
| `REDIS_HOST`           | Redis hostname        | `redis`            |
| `REDIS_PORT`           | Redis port            | `6379`             |
| `MAX_AUDIO_SIZE_MB`    | Maximum upload size   | `100`              |
| `AUDIO_JOB_ATTEMPTS`   | Retry attempts        | `3`                |
| `AUDIO_JOB_BACKOFF_MS` | Retry delay           | `5000`             |

## Docker

Build and start:

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f api
```

Stop:

```bash
docker compose down
```

## Testing

```bash
npm test
```

For end-to-end tests:

```bash
npm run test:e2e
```

## Security Considerations

For public production deployment, consider adding:

* API authentication
* Authorization
* Rate limiting
* File-content validation
* Private object storage
* Signed download URLs
* Secrets management
* Structured logging
* Monitoring and alerting
