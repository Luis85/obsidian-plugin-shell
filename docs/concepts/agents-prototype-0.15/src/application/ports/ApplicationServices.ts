import type { Clock } from './Clock'
import type { IdGenerator } from './IdGenerator'
import type { StateRepository } from './StateRepository'
export interface CommandServices { clock: Clock; ids: IdGenerator }
export interface ApplicationServices extends CommandServices { repository: StateRepository }
