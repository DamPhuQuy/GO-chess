import { Controller, Get, Header } from '@nestjs/common';
import { DocsService } from './docs.service.js';

@Controller('docs')
export class DocsController {
  constructor(private readonly docsService: DocsService) {}

  @Get()
  @Header('Vary', 'Accept')
  @Header('Cache-Control', 'public, max-age=3600')
  getGuide(): object {
    return this.docsService.getGuide();
  }
}
