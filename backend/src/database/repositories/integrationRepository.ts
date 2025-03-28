import lodash from 'lodash'
import Sequelize, { QueryTypes } from 'sequelize'

import { captureApiChange, integrationConnectAction } from '@crowd/audit-logs'
import { DEFAULT_TENANT_ID, Error404 } from '@crowd/common'
import {
  fetchGlobalIntegrations,
  fetchGlobalIntegrationsCount,
  fetchGlobalIntegrationsStatusCount,
  fetchGlobalNotConnectedIntegrations,
  fetchGlobalNotConnectedIntegrationsCount,
} from '@crowd/data-access-layer/src/integrations'
import { IntegrationRunState, PlatformType } from '@crowd/types'

import SequelizeFilterUtils from '../utils/sequelizeFilterUtils'

import { IRepositoryOptions } from './IRepositoryOptions'
import AuditLogRepository from './auditLogRepository'
import QueryParser from './filters/queryParser'
import { QueryOutput } from './filters/queryTypes'
import SequelizeRepository from './sequelizeRepository'

const { Op } = Sequelize
const log: boolean = false

class IntegrationRepository {
  static async create(data, options: IRepositoryOptions) {
    const currentUser = SequelizeRepository.getCurrentUser(options)

    const transaction = SequelizeRepository.getTransaction(options)

    const segment = SequelizeRepository.getStrictlySingleActiveSegment(options)

    const toInsert = {
      ...lodash.pick(data, [
        'platform',
        'status',
        'limitCount',
        'limitLastResetAt',
        'token',
        'refreshToken',
        'settings',
        'integrationIdentifier',
        'importHash',
        'emailSentAt',
      ]),
      segmentId: segment.id,
      tenantId: DEFAULT_TENANT_ID,
      createdById: currentUser.id,
      updatedById: currentUser.id,
      id: data.id || undefined,
    }
    const record = await options.database.integration.create(toInsert, {
      transaction,
    })

    await captureApiChange(
      options,
      integrationConnectAction(record.id, async (captureState) => {
        captureState(toInsert)
      }),
    )

    await this._createAuditLog(AuditLogRepository.CREATE, record, data, options)

    return this.findById(record.id, options)
  }

  static async update(id, data, options: IRepositoryOptions) {
    const currentUser = SequelizeRepository.getCurrentUser(options)

    const transaction = SequelizeRepository.getTransaction(options)

    let record = await options.database.integration.findOne({
      where: {
        id,
        segmentId: SequelizeRepository.getSegmentIds(options),
      },
      transaction,
    })

    if (!record) {
      throw new Error404()
    }

    record = await record.update(
      {
        ...lodash.pick(data, [
          'platform',
          'status',
          'limitCount',
          'limitLastResetAt',
          'token',
          'refreshToken',
          'settings',
          'integrationIdentifier',
          'importHash',
          'emailSentAt',
        ]),

        updatedById: currentUser.id,
      },
      {
        transaction,
      },
    )

    await this._createAuditLog(AuditLogRepository.UPDATE, record, data, options)

    return this.findById(record.id, options)
  }

  static async destroy(id, options: IRepositoryOptions) {
    const transaction = SequelizeRepository.getTransaction(options)

    const record = await options.database.integration.findOne({
      where: {
        id,
      },
      transaction,
    })

    if (!record) {
      throw new Error404()
    }

    await record.destroy({
      transaction,
    })

    // also mark integration runs as deleted
    const seq = SequelizeRepository.getSequelize(options)

    await seq.query(
      `update integration.runs set state = :newState
     where "integrationId" = :integrationId and state in (:delayed, :pending, :processing)`,
      {
        replacements: {
          newState: IntegrationRunState.INTEGRATION_DELETED,
          delayed: IntegrationRunState.DELAYED,
          pending: IntegrationRunState.PENDING,
          processing: IntegrationRunState.PROCESSING,
          integrationId: id,
        },
        transaction,
      },
    )

    await this._createAuditLog(AuditLogRepository.DELETE, record, record, options)
  }

  static async findAllByPlatform(platform, options: IRepositoryOptions) {
    const transaction = SequelizeRepository.getTransaction(options)

    const include = []

    const records = await options.database.integration.findAll({
      where: {
        platform,
      },
      include,
      transaction,
    })

    return records.map((record) => record.get({ plain: true }))
  }

  static async findByPlatform(platform, options: IRepositoryOptions) {
    const transaction = SequelizeRepository.getTransaction(options)

    const segment = SequelizeRepository.getStrictlySingleActiveSegment(options)

    const include = []

    const record = await options.database.integration.findOne({
      where: {
        platform,
        segmentId: segment.id,
      },
      include,
      transaction,
    })

    if (!record) {
      throw new Error404()
    }

    return this._populateRelations(record)
  }

  static async findActiveIntegrationByPlatform(platform: PlatformType) {
    const options = await SequelizeRepository.getDefaultIRepositoryOptions()

    const record = await options.database.integration.findOne({
      where: {
        platform,
      },
    })

    if (!record) {
      throw new Error404()
    }

    return this._populateRelations(record)
  }

  /**
   * Find all active integrations for a platform
   * @param platform The platform we want to find all active integrations for
   * @returns All active integrations for the platform
   */
  static async findAllActive(platform: string, page: number, perPage: number): Promise<any[]> {
    const options = await SequelizeRepository.getDefaultIRepositoryOptions()

    const records = await options.database.integration.findAll({
      where: {
        status: 'done',
        platform,
      },
      limit: perPage,
      offset: (page - 1) * perPage,
      order: [['id', 'ASC']],
    })

    if (!records) {
      throw new Error404()
    }

    return Promise.all(records.map((record) => this._populateRelations(record)))
  }

  static async findByStatus(
    status: string,
    page: number,
    perPage: number,
    options: IRepositoryOptions,
  ): Promise<any[]> {
    const query = `
      select * from integrations where status = :status
      limit ${perPage} offset ${(page - 1) * perPage}
    `

    const seq = SequelizeRepository.getSequelize(options)

    const transaction = SequelizeRepository.getTransaction(options)

    const integrations = await seq.query(query, {
      replacements: {
        status,
      },
      type: QueryTypes.SELECT,
      transaction,
    })

    return integrations as any[]
  }

  /**
   * Find an integration using the integration identifier and a platform.
   * @param identifier The integration identifier
   * @returns The integration object
   */
  // TODO: Test
  static async findByIdentifier(identifier: string, platform: string): Promise<Array<Object>> {
    const options = await SequelizeRepository.getDefaultIRepositoryOptions()

    const record = await options.database.integration.findOne({
      where: {
        integrationIdentifier: identifier,
        platform,
        deletedAt: null,
      },
    })

    if (!record) {
      throw new Error404()
    }

    return this._populateRelations(record)
  }

  static async findById(id, options: IRepositoryOptions) {
    const transaction = SequelizeRepository.getTransaction(options)

    const include = []

    const record = await options.database.integration.findOne({
      where: {
        id,
      },
      include,
      transaction,
    })

    if (!record) {
      throw new Error404()
    }

    return this._populateRelations(record)
  }

  static async count(filter, options: IRepositoryOptions) {
    const transaction = SequelizeRepository.getTransaction(options)

    return options.database.integration.count({
      where: {
        ...filter,
      },
      transaction,
    })
  }

  /**
   * Finds global integrations based on the provided parameters.
   *
   * @param {Object} filters - An object containing various filter options.
   * @param {string} [filters.platform=null] - The platform to filter integrations by.
   * @param {string[]} [filters.status=['done']] - The status of the integrations to be filtered.
   * @param {string} [filters.query=''] - The search query to filter integrations.
   * @param {number} [filters.limit=20] - The maximum number of integrations to return.
   * @param {number} [filters.offset=0] - The offset for pagination.
   * @param {IRepositoryOptions} options - The repository options for querying.
   * @returns {Promise<Object>} The result containing the rows of integrations and metadata about the query.
   */
  static async findGlobalIntegrations(
    { platform = null, status = ['done'], query = '', limit = 20, offset = 0 },
    options: IRepositoryOptions,
  ) {
    const qx = SequelizeRepository.getQueryExecutor(options)
    if (status.includes('not-connected')) {
      const rows = await fetchGlobalNotConnectedIntegrations(qx, platform, query, limit, offset)
      const [result] = await fetchGlobalNotConnectedIntegrationsCount(qx, platform, query)
      return { rows, count: +result.count, limit: +limit, offset: +offset }
    }

    const rows = await fetchGlobalIntegrations(qx, status, platform, query, limit, offset)
    const [result] = await fetchGlobalIntegrationsCount(qx, status, platform, query)
    return { rows, count: +result.count, limit: +limit, offset: +offset }
  }

  /**
   * Retrieves the count of global integrations statuses for a specified platform.
   * This method aggregates the count of different integration statuses including a 'not-connected' status.
   *
   * @param {Object} param1 - The optional parameters.
   * @param {string|null} [param1.platform=null] - The platform to filter the integrations. Default is null.
   * @param {IRepositoryOptions} options - The options for the repository operations.
   * @return {Promise<Array<Object>>} A promise that resolves to an array of objects containing the statuses and their counts.
   */
  static async findGlobalIntegrationsStatusCount({ platform = null }, options: IRepositoryOptions) {
    const qx = SequelizeRepository.getQueryExecutor(options)
    const [result] = await fetchGlobalNotConnectedIntegrationsCount(qx, platform, '')
    const rows = await fetchGlobalIntegrationsStatusCount(qx, platform)
    return [...rows, { status: 'not-connected', count: +result.count }]
  }

  static async findAndCountAll(
    { filter = {} as any, advancedFilter = null as any, limit = 0, offset = 0, orderBy = '' },
    options: IRepositoryOptions,
  ) {
    const include = []

    // If the advanced filter is empty, we construct it from the query parameter filter
    if (!advancedFilter) {
      advancedFilter = { and: [] }

      if (filter.id) {
        advancedFilter.and.push({
          id: filter.id,
        })
      }

      if (filter.platform) {
        advancedFilter.and.push({
          platform: filter.platform,
        })
      }

      if (filter.status) {
        advancedFilter.and.push({
          status: filter.status,
        })
      }

      if (filter.limitCountRange) {
        const [start, end] = filter.limitCountRange

        if (start !== undefined && start !== null && start !== '') {
          advancedFilter.and.push({
            limitCount: {
              gte: start,
            },
          })
        }

        if (end !== undefined && end !== null && end !== '') {
          advancedFilter.and.push({
            limitCount: {
              lte: end,
            },
          })
        }
      }

      if (filter.limitLastResetAtRange) {
        const [start, end] = filter.limitLastResetAtRange

        if (start !== undefined && start !== null && start !== '') {
          advancedFilter.and.push({
            limitLastResetAt: {
              gte: start,
            },
          })
        }

        if (end !== undefined && end !== null && end !== '') {
          advancedFilter.and.push({
            limitLastResetAt: {
              lte: end,
            },
          })
        }
      }

      if (filter.integrationIdentifier) {
        advancedFilter.and.push({
          integrationIdentifier: filter.integrationIdentifier,
        })
      }

      if (filter.createdAtRange) {
        const [start, end] = filter.createdAtRange

        if (start !== undefined && start !== null && start !== '') {
          advancedFilter.and.push({
            createdAt: {
              gte: start,
            },
          })
        }

        if (end !== undefined && end !== null && end !== '') {
          advancedFilter.and.push({
            createdAt: {
              lte: end,
            },
          })
        }
      }
    }

    const parser = new QueryParser(
      {
        nestedFields: {
          sentiment: 'sentiment.sentiment',
        },
      },
      options,
    )

    const parsed: QueryOutput = parser.parse({
      filter: advancedFilter,
      orderBy: orderBy || ['createdAt_DESC'],
      limit,
      offset,
    })

    let {
      rows,
      count, // eslint-disable-line prefer-const
    } = await options.database.integration.findAndCountAll({
      ...(parsed.where ? { where: parsed.where } : {}),
      ...(parsed.having ? { having: parsed.having } : {}),
      order: parsed.order,
      limit: limit ? parsed.limit : undefined,
      offset: offset ? parsed.offset : undefined,
      include,
      transaction: SequelizeRepository.getTransaction(options),
    })

    rows = await this._populateRelationsForRows(rows)

    // Some integrations (i.e GitHub, Discord, Discourse, Groupsio) receive new data via webhook post-onboarding.
    // We track their last processedAt separately, and not using updatedAt.
    const seq = SequelizeRepository.getSequelize(options)

    const integrationIds = rows.map((row) => row.id)

    if (integrationIds.length > 0) {
      const webhookQuery = `
        SELECT "integrationId", MAX("processedAt") AS "webhookProcessedAt"
        FROM "incomingWebhooks"
        WHERE "integrationId" IN (:integrationIds) AND state = 'PROCESSED'
        GROUP BY "integrationId"
      `

      const runQuery = `
        SELECT "integrationId", MAX("processedAt") AS "runProcessedAt"
        FROM integration.runs
        WHERE "integrationId" IN (:integrationIds)
        GROUP BY "integrationId"
      `

      const [webhookResults, runResults] = await Promise.all([
        seq.query(webhookQuery, {
          replacements: { integrationIds },
          type: QueryTypes.SELECT,
          transaction: SequelizeRepository.getTransaction(options),
        }),
        seq.query(runQuery, {
          replacements: { integrationIds },
          type: QueryTypes.SELECT,
          transaction: SequelizeRepository.getTransaction(options),
        }),
      ])

      const processedAtMap = integrationIds.reduce((map, id) => {
        const webhookResult: any = webhookResults.find(
          (r: { integrationId: string }) => r.integrationId === id,
        )
        const runResult: any = runResults.find(
          (r: { integrationId: string }) => r.integrationId === id,
        )
        map[id] = {
          webhookProcessedAt: webhookResult ? webhookResult.webhookProcessedAt : null,
          runProcessedAt: runResult ? runResult.runProcessedAt : null,
        }
        return map
      }, {})

      rows.forEach((row) => {
        const processedAt = processedAtMap[row.id]
        // Use the latest processedAt from either webhook or run, or fall back to updatedAt
        row.lastProcessedAt = processedAt
          ? new Date(
              Math.max(
                processedAt.webhookProcessedAt
                  ? new Date(processedAt.webhookProcessedAt).getTime()
                  : 0,
                processedAt.runProcessedAt ? new Date(processedAt.runProcessedAt).getTime() : 0,
                new Date(row.updatedAt).getTime(),
              ),
            )
          : row.updatedAt
      })
    }

    return { rows, count, limit: parsed.limit, offset: parsed.offset }
  }

  static async findAllAutocomplete(query, limit, options: IRepositoryOptions) {
    const whereAnd: Array<any> = [{}]

    if (query) {
      whereAnd.push({
        [Op.or]: [
          { id: SequelizeFilterUtils.uuid(query) },
          {
            [Op.and]: SequelizeFilterUtils.ilikeIncludes('integration', 'platform', query),
          },
        ],
      })
    }

    const where = { [Op.and]: whereAnd }

    const records = await options.database.integration.findAll({
      attributes: ['id', 'platform'],
      where,
      limit: limit ? Number(limit) : undefined,
      order: [['platform', 'ASC']],
    })

    return records.map((record) => ({
      id: record.id,
      label: record.platform,
    }))
  }

  static async _createAuditLog(action, record, data, options: IRepositoryOptions) {
    if (log) {
      let values = {}

      if (data) {
        values = {
          ...record.get({ plain: true }),
        }
      }

      await AuditLogRepository.log(
        {
          entityName: 'integration',
          entityId: record.id,
          action,
          values,
        },
        options,
      )
    }
  }

  static async _populateRelationsForRows(rows) {
    if (!rows) {
      return rows
    }

    return Promise.all(rows.map((record) => this._populateRelations(record)))
  }

  static async _populateRelations(record) {
    if (!record) {
      return record
    }

    const output = record.get({ plain: true })

    return output
  }
}

export default IntegrationRepository
