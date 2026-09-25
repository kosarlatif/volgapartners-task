import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { AudioProcessor } from './audio.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transcription',
    }),
  ],

  controllers: [AudioController],

  providers: [
    AudioService,
    AudioProcessor,
  ],

  exports: [AudioService],
})
export class AudioModule {}