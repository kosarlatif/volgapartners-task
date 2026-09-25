import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AudioService {
  constructor(
    private readonly prisma: PrismaService,

    @InjectQueue('transcription')
    private readonly queue: Queue,
  ) {}

  async createJob(
    file: Express.Multer.File,
  ) {
    const job = await this.prisma.transcriptionJob.create({
      data: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: 'QUEUED',
      },
    });

    /*
     * For this demo, the uploaded buffer is passed to the queue.
     *
     * In a high-volume production system:
     *
     * Client -> Object Storage -> Queue -> Worker
     *
     * You should store the file in S3/Azure Blob Storage
     * and put only the storage key in the queue.
     */

    await this.queue.add(
      'transcribe',
      {
        jobId: job.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer.toString('base64'),
      },
      {
        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 5000,
        },

        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  async getJob(id: string) {
    const job =
      await this.prisma.transcriptionJob.findUnique({
        where: {
          id,
        },

        include: {
          segments: {
            orderBy: {
              start: 'asc',
            },
          },
        },
      });

    if (!job) {
      throw new NotFoundException(
        'Transcription job not found',
      );
    }

    return job;
  }
}