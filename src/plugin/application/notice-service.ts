import { NotificationService } from './notification-service';
import type { NotificationRequest } from './notification-policy';
type NoticeRequest = Omit<NotificationRequest, 'kind'>;
/** Native-first convenience over the same inherited policy and owned state. */
export class NoticeService extends NotificationService {
  info(request: NoticeRequest) { return this.notify({ ...request, native: request.native ?? true, kind: 'info' }); }
  success(request: NoticeRequest) { return this.notify({ ...request, native: request.native ?? true, kind: 'success' }); }
  warning(request: NoticeRequest) { return this.notify({ ...request, native: request.native ?? true, kind: 'warning' }); }
  error(request: NoticeRequest) { return this.notify({ ...request, native: request.native ?? true, kind: 'error' }); }
  progress(request: NoticeRequest) { return this.notify({ ...request, native: request.native ?? true, kind: 'progress' }); }
}
