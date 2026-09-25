import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import { Job } from 'bullmq';

import OpenAI from 'openai';

import { PrismaService } from '../prisma/prisma.service';

interface TranscriptionJobData {
  jobId: string;
  filename: string;
  mimeType: string;
  buffer: string;
}

@Injectable()
@Processor('transcription')
export class AudioProcessor
  extends WorkerHost
{
  private readonly logger =
    new Logger(AudioProcessor.name);

  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
  ) {
    super();

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async process(
    job: Job<TranscriptionJobData>,
  ) {
    const {
      jobId,
      filename,
      mimeType,
      buffer,
    } = job.data;

    const isFinalAttempt =
      job.attemptsMade >=
      (job.opts.attempts ?? 1) - 1;

    this.logger.log(
      `Processing transcription ${jobId}`,
    );

    await this.prisma.transcriptionJob.update({
      where: {
        id: jobId,
      },

      data: {
        status: 'PROCESSING',
        errorMessage: null,
      },
    });

    try {
      const audioBuffer =
        Buffer.from(buffer, 'base64');

      const file = await OpenAI.toFile(
        audioBuffer,
        filename,
        {
          type: mimeType,
        },
      );

      const result =
        await this.openai.audio.transcriptions.create(
          {
            model: 'whisper-1',

            file,

            response_format: 'verbose_json',

            timestamp_granularities: [
              'segment',
            ],
          },
        );

      /*
       * Store everything in one transaction.
       */

      await this.prisma.$transaction(
        async (tx) => {
          await tx.transcriptionSegment.deleteMany(
            {
              where: {
                jobId,
              },
            },
          );

          await tx.transcriptionSegment.createMany(
            {
              data: (
                result.segments || []
              ).map((segment) => ({
                jobId,

                start: segment.start,

                end: segment.end,

                text: segment.text.trim(),
              })),
            },
          );

          await tx.transcriptionJob.update({
            where: {
              id: jobId,
            },

            data: {
              status: 'COMPLETED',

              fullText: result.text,

              language:
                result.language ?? null,

              completedAt:
                new Date(),
            },
          });
        },
      );

      this.logger.log(
        `Transcription completed ${jobId}`,
      );

      return {
        jobId,
        status: 'completed',
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.error(
        `Transcription failed ${jobId}: ${message}`,
      );

      /*
       * BullMQ will retry this job according
       * to the configured retry policy.
       */
      await this.prisma.transcriptionJob.update({
        where: {
          id: jobId,
        },

        data: {
          status: isFinalAttempt ? 'FAILED': 'QUEUED',
          errorMessage: message,
        },
      });

      throw error;
    }
  }
}