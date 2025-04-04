import {
  IntegrationRunWorkerEmitter,
  IntegrationStreamWorkerEmitter,
  SearchSyncWorkerEmitter,
} from '@crowd/common_services'
import { getDbConnection } from '@crowd/data-access-layer/src/database'
import { getServiceLogger } from '@crowd/logging'
import { QueueFactory } from '@crowd/queue'
import { ApiPubSubEmitter, getRedisClient } from '@crowd/redis'

import { DB_CONFIG, QUEUE_CONFIG, REDIS_CONFIG, WORKER_CONFIG } from './conf'
import { WorkerQueueReceiver } from './queue'

const log = getServiceLogger()

const MAX_CONCURRENT_PROCESSING = 2

setImmediate(async () => {
  log.info('Starting integration run worker...')
  const queueClient = QueueFactory.createQueueService(QUEUE_CONFIG())

  const dbConnection = await getDbConnection(DB_CONFIG(), MAX_CONCURRENT_PROCESSING)
  const redis = await getRedisClient(REDIS_CONFIG(), true)

  const runWorkerEmitter = new IntegrationRunWorkerEmitter(queueClient, log)
  const streamWorkerEmitter = new IntegrationStreamWorkerEmitter(queueClient, log)
  const searchSyncWorkerEmitter = new SearchSyncWorkerEmitter(queueClient, log)

  const apiPubSubEmitter = new ApiPubSubEmitter(redis, log)

  const queue = new WorkerQueueReceiver(
    WORKER_CONFIG().queuePriorityLevel,
    queueClient,
    redis,
    dbConnection,
    streamWorkerEmitter,
    runWorkerEmitter,
    searchSyncWorkerEmitter,
    apiPubSubEmitter,
    log,
    MAX_CONCURRENT_PROCESSING,
  )

  try {
    await streamWorkerEmitter.init()
    await runWorkerEmitter.init()
    await searchSyncWorkerEmitter.init()
    await queue.start()
  } catch (err) {
    log.error({ err }, 'Failed to start queues!')
    process.exit(1)
  }
})
