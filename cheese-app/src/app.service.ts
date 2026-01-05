import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'You can’t eat your cake and have it — but with cheese, you get the flavor and the reminder.';
  }
}
