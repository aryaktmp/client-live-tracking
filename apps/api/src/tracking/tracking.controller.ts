import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('api/trackers')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get()
  getAllTrackers() {
    return this.trackingService.getAllTrackers();
  }

  @Get(':id/history')
  getTrackerHistory(@Param('id') id: string) {
    const history = this.trackingService.getTrackerHistory(id);
    if (!history.length) {
      throw new NotFoundException(
        `History for tracker with ID "${id}" not found.`,
      );
    }
    return history;
  }
}
