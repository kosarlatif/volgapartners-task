import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import {
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AudioService } from './audio.service';

@ApiTags('Transcription')
@Controller('api/v1/transcriptions')
export class AudioController {
  constructor(
    private readonly audioService: AudioService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Upload audio for transcription',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),

      limits: {
        fileSize:
          Number(
            process.env.MAX_AUDIO_SIZE_MB || 100,
          ) *
          1024 *
          1024,
      },

      fileFilter: (
        _request,
        file,
        callback,
      ) => {
        const allowedTypes = [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/x-wav',
          'audio/wave',
          'audio/mp4',
          'audio/m4a',
          'audio/webm',
          'audio/ogg',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Unsupported audio format',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Audio file is required',
      );
    }

    return this.audioService.createJob(file);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get transcription status/result',
  })
  async get(
    @Param('id') id: string,
  ) {
    return this.audioService.getJob(id);
  }
}