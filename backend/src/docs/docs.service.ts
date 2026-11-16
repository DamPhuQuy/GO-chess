import { Injectable } from '@nestjs/common';
import guide from './guide.json' with { type: 'json' };

@Injectable()
export class DocsService {
  getGuide(): object {
    return guide;
  }
}
