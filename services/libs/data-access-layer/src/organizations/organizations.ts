import {
  DEFAULT_TENANT_ID,
  UnrepeatableError,
  generateUUIDv1,
  normalizeHostname,
} from '@crowd/common'
import { getServiceChildLogger, logExecutionTimeV2 } from '@crowd/logging'
import {
  IMemberOrganization,
  IOrganization,
  IOrganizationIdSource,
  IQueryTimeseriesParams,
  ITimeseriesDatapoint,
  OrganizationIdentityType,
} from '@crowd/types'

import { QueryExecutor } from '../queryExecutor'
import { prepareSelectColumns } from '../utils'

import { findOrgAttributes, markOrgAttributeDefault, upsertOrgAttributes } from './attributes'
import { addOrgIdentity, upsertOrgIdentities } from './identities'
import {
  IDbOrgIdentity,
  IDbOrganization,
  IDbOrganizationInput,
  IEnrichableOrganizationData,
} from './types'
import { prepareOrganizationData } from './utils'

const log = getServiceChildLogger('data-access-layer/organizations')

const ORG_SELECT_COLUMNS = [
  'id',
  'description',
  'displayName',
  'logo',
  'tags',
  'employees',
  'revenueRange',
  'importHash',
  'location',
  'isTeamOrganization',
  'type',
  'size',
  'headline',
  'industry',
  'founded',
  'employeeChurnRate',
  'employeeGrowthRate',
  'manuallyCreated',
]

export async function findOrgIdByDisplayName(
  qx: QueryExecutor,
  {
    orgName,
    exact = false,
  }: {
    orgName: string
    exact: boolean
  },
): Promise<string | null> {
  const displayNameClause = exact
    ? '"displayName" = $(displayName)'
    : '"displayName" ILIKE $(displayName)'

  const result = await qx.selectOneOrNone(
    `
      SELECT id
      FROM organizations
      WHERE ${displayNameClause}
        AND "deletedAt" IS NULL
      LIMIT 1;
    `,
    {
      displayName: exact ? orgName : `%${orgName}%`,
    },
  )

  if (result) {
    return result.id
  }

  return null
}

export async function findOrgBySourceId(
  qx: QueryExecutor,
  segmentId: string,
  platform: string,
  sourceId: string,
): Promise<IDbOrganization | null> {
  const result = await qx.selectOneOrNone(
    `
    with
        "organizationsWithSourceIdAndSegment" as (
            select oi."organizationId"
            from "organizationIdentities" oi
            join "organizationSegments" os on oi."organizationId" = os."organizationId"
            where
                  oi.platform = $(platform)
                  and oi."sourceId" = $(sourceId)
                  and os."segmentId" =  $(segmentId)
            order by oi."updatedAt" desc
            limit 1
        )
    select ${prepareSelectColumns(ORG_SELECT_COLUMNS, 'o')}
    from organizations o
    where o.id in (select distinct "organizationId" from "organizationsWithSourceIdAndSegment");`,
    { sourceId, segmentId, platform },
  )

  return result
}

export async function findOrgById(
  qe: QueryExecutor,
  organizationId: string,
): Promise<IDbOrganization | null> {
  const result = await qe.selectOneOrNone(
    `
    select  ${prepareSelectColumns(ORG_SELECT_COLUMNS, 'o')}
    from organizations o
    WHERE o.id = $(organizationId)
    `,
    {
      organizationId,
    },
  )

  return result
}

export async function findOrgByName(
  qx: QueryExecutor,
  name: string,
): Promise<IDbOrganization | null> {
  const result = await qx.selectOneOrNone(
    `
          select  ${prepareSelectColumns(ORG_SELECT_COLUMNS, 'o')}
          from organizations o
          where trim(lower(o."displayName")) = trim(lower($(name)))
          limit 1;
    `,
    {
      name,
    },
  )

  return result
}

export async function findOrgByVerifiedDomain(
  qx: QueryExecutor,
  identity: IDbOrgIdentity,
): Promise<IDbOrganization | null> {
  if (identity.type !== OrganizationIdentityType.PRIMARY_DOMAIN) {
    throw new Error('Invalid identity type')
  }
  const result = await qx.selectOneOrNone(
    `
    with "organizationsWithIdentity" as (
              select oi."organizationId"
              from "organizationIdentities" oi
              where
                    lower(oi.value) = lower($(value))
                    and oi.type = $(type)
                    and oi.verified = true
          )
          select  ${prepareSelectColumns(ORG_SELECT_COLUMNS, 'o')}
          from organizations o
          where o.id in (select distinct "organizationId" from "organizationsWithIdentity")
          limit 1;
    `,
    {
      value: identity.value,
      platform: identity.platform,
      type: identity.type,
    },
  )

  return result
}

export async function findOrgByVerifiedIdentity(
  qx: QueryExecutor,
  identity: IDbOrgIdentity,
): Promise<IDbOrganization | null> {
  const result = await qx.selectOneOrNone(
    `
    with "organizationsWithIdentity" as (
              select oi."organizationId"
              from "organizationIdentities" oi
              where
                    oi.platform = $(platform)
                    and lower(oi.value) = lower($(value))
                    and oi.type = $(type)
                    and oi.verified = true
          )
          select  ${prepareSelectColumns(ORG_SELECT_COLUMNS, 'o')}
          from organizations o
          where o.id in (select distinct "organizationId" from "organizationsWithIdentity")
          limit 1;
    `,
    {
      value: identity.value,
      platform: identity.platform,
      type: identity.type,
    },
  )

  return result
}

export async function getOrgIdentities(
  qx: QueryExecutor,
  organizationId: string,
): Promise<IDbOrgIdentity[]> {
  return await qx.select(
    `
      select platform,
             type,
             value,
             verified,
             "sourceId",
             "integrationId"
      from "organizationIdentities"
      where "organizationId" = $(organizationId)
    `,
    {
      organizationId,
    },
  )
}

export async function getOrgIdsToEnrich(
  qe: QueryExecutor,
  perPage: number,
  page: number,
): Promise<IEnrichableOrganizationData[]> {
  const conditions: string[] = [
    'o."deletedAt" is null',
    `(o."lastEnrichedAt" is null or o."lastEnrichedAt" < now() - interval '3 months')`,
    'ad."activityCount" >= 3',
  ]

  const query = `
  with activity_data as (select "organizationId",
                                sum("activityCount")  as "activityCount",
                                max("lastActive")     as "lastActive"
                        from "organizationSegmentsAgg"
                        group by "organizationId")
  select o.id as "organizationId"
  from organizations o
          inner join activity_data ad on ad."organizationId" = o.id
  where ${conditions.join(' and ')}
  order by ad."activityCount" desc
  limit ${perPage} offset ${(page - 1) * perPage};
  `

  const results = await qe.select(query)
  return results
}

export async function markOrganizationEnriched(
  qe: QueryExecutor,
  organizationId: string,
): Promise<void> {
  await qe.selectNone(
    `
    update organizations
    set "lastEnrichedAt" = now()
    where id = $(organizationId)
    `,
    {
      organizationId,
    },
  )
}

export async function addOrgsToSegments(
  qe: QueryExecutor,
  segmentIds: string[],
  orgIds: string[],
): Promise<void> {
  if (orgIds.length === 0 || segmentIds.length === 0) {
    return
  }

  const parameters: Record<string, unknown> = {
    tenantId: DEFAULT_TENANT_ID,
  }

  const valueStrings = []
  for (let i = 0; i < orgIds.length; i++) {
    const orgParam = `orgId_${i}`
    const orgId = orgIds[i]
    parameters[orgParam] = orgId

    for (let j = 0; j < segmentIds.length; j++) {
      const segmentParam = `segmentId_${i}_${j}`
      parameters[segmentParam] = segmentIds[j]
      valueStrings.push(`($(tenantId), $(${segmentParam}), $(orgId_${i}), now())`)
    }
  }

  const valueString = valueStrings.join(',')

  const query = `
  insert into "organizationSegments"("tenantId", "segmentId", "organizationId", "createdAt")
  values ${valueString}
  on conflict do nothing;
  `

  await qe.selectNone(query, parameters)
}

export async function addOrgsToMember(
  qe: QueryExecutor,
  memberId: string,
  orgs: IOrganizationIdSource[],
): Promise<void> {
  const parameters: Record<string, unknown> = {
    memberId,
  }

  const valueStrings = []
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]
    parameters[`orgId_${i}`] = org.id
    parameters[`source_${i}`] = org.source
    valueStrings.push(`($(orgId_${i}), $(memberId), now(), now(), $(source_${i}))`)
  }

  const valueString = valueStrings.join(',')

  const query = `
  insert into "memberOrganizations"("organizationId", "memberId", "createdAt", "updatedAt", "source")
  values ${valueString}
  on conflict do nothing;
  `

  await qe.selectNone(query, parameters)
}

export async function findMemberOrganizations(
  qe: QueryExecutor,
  memberId: string,
  organizationId: string,
): Promise<IMemberOrganization[]> {
  return await qe.select(
    `
    select *
    from "memberOrganizations"
    where "memberId" = $(memberId) and "organizationId" = $(organizationId)
    `,
    {
      memberId,
      organizationId,
    },
  )
}

export async function insertOrganization(
  qe: QueryExecutor,
  data: IDbOrganizationInput,
): Promise<string> {
  const columns = Object.keys(data)

  if (columns.length === 0) {
    throw new Error('No data to insert')
  }

  const id = generateUUIDv1()
  const now = new Date()

  columns.push('id')
  columns.push('tenantId')
  columns.push('createdAt')
  columns.push('updatedAt')

  const query = `
    insert into organizations(${columns.map((c) => `"${c}"`).join(', ')})
    values(${columns.map((c) => `$(${c})`).join(', ')})
  `

  const result = await qe.result(query, {
    ...data,
    id,
    tenantId: DEFAULT_TENANT_ID,
    createdAt: now,
    updatedAt: now,
  })

  if (result.rowCount !== 1) {
    throw new Error('Failed to insert organization')
  }

  return id
}

export async function updateOrganization(
  qe: QueryExecutor,
  organizationId: string,
  data: IDbOrganizationInput,
): Promise<void> {
  const columns = Object.keys(data)
  if (columns.length === 0) {
    return
  }

  const updatedAt = new Date()
  const oneMinuteAgo = new Date(updatedAt.getTime() - 60 * 1000)
  columns.push('updatedAt')

  const query = `
    update organizations set
      ${columns.map((c) => `"${c}" = $(${c})`).join(',\n')}
    where id = $(organizationId) and "updatedAt" <= $(oneMinuteAgo)
  `

  await qe.selectNone(query, {
    ...data,
    organizationId,
    updatedAt,
    oneMinuteAgo,
  })
}

export async function getTimeseriesOfNewOrganizations(
  qx: QueryExecutor,
  params: IQueryTimeseriesParams,
): Promise<ITimeseriesDatapoint[]> {
  const query = `
    SELECT
      COUNT(DISTINCT o.id) AS count,
      TO_CHAR(osa."joinedAt", 'YYYY-MM-DD') AS "date"
    FROM organizations AS o
    JOIN "organizationSegmentsAgg" osa ON osa."organizationId" = o.id
    WHERE osa."joinedAt" >= $(startDate)
      AND osa."joinedAt" < $(endDate)
      ${params.segmentIds ? 'AND osa."segmentId" IN ($(segmentIds:csv))' : 'AND osa."segmentId" IS NULL'}
      ${params.platform ? 'AND $(platform) = ANY(osa."activeOn")' : ''}
    GROUP BY 2
    ORDER BY 2
  `

  return qx.select(query, { ...params })
}

export async function getTimeseriesOfActiveOrganizations(
  qx: QueryExecutor,
  params: IQueryTimeseriesParams,
): Promise<ITimeseriesDatapoint[]> {
  const query = `
    SELECT
      COUNT_DISTINCT("organizationId") AS count,
      DATE_TRUNC('day', timestamp)
    FROM activities
    WHERE "deletedAt" IS NULL
      AND "organizationId" IS NOT NULL
      ${params.segmentIds ? 'AND "segmentId" IN ($(segmentIds:csv))' : ''}
      AND timestamp >= $(startDate)
      AND timestamp < $(endDate)
      ${params.platform ? 'AND "platform" = $(platform)' : ''}
    GROUP BY 2
    ORDER BY 2
  `

  return qx.select(query, { ...params })
}

export async function findOrCreateOrganization(
  qe: QueryExecutor,
  source: string,
  data: IOrganization,
  integrationId?: string,
): Promise<string | undefined> {
  const verifiedIdentities = data.identities ? data.identities.filter((i) => i.verified) : []

  if (verifiedIdentities.length === 0 && !data.displayName) {
    const message = `Missing organization identity or displayName while creating/updating organization!`
    log.error(data, message)
    throw new UnrepeatableError(message)
  }

  try {
    // Normalize the website identities
    for (const identity of data.identities.filter((i) =>
      [
        OrganizationIdentityType.PRIMARY_DOMAIN,
        OrganizationIdentityType.ALTERNATIVE_DOMAIN,
      ].includes(i.type),
    )) {
      identity.value = normalizeHostname(identity.value, false)
    }

    data.identities = data.identities.filter((i) => i.value !== undefined)

    let existing
    // find existing org by sent verified identities
    for (const identity of verifiedIdentities) {
      existing = await logExecutionTimeV2(
        async () => findOrgByVerifiedIdentity(qe, identity),
        log,
        'organizationService -> findOrCreateOrganization -> findOrgByVerifiedIdentity',
      )

      if (!existing && identity.type === OrganizationIdentityType.PRIMARY_DOMAIN) {
        // if primary domain isn't found in the incoming platform, check if the domain exists in any platform
        existing = await logExecutionTimeV2(
          async () => findOrgByVerifiedDomain(qe, identity),
          log,
          'organizationService -> findOrCreateOrganization -> findOrgByVerifiedDomain',
        )
      }
      if (existing) {
        break
      }
    }

    if (!existing) {
      existing = await logExecutionTimeV2(
        async () => findOrgByName(qe, data.displayName),
        log,
        'organizationService -> findOrCreateOrganization -> findOrgByName',
      )
    }

    let id

    if (!existing && verifiedIdentities.length === 0) {
      log.debug(
        'Organization does not have any verified identities and was not found by name so we will not create it.',
      )
      return undefined
    }

    if (existing) {
      log.trace(`Found existing organization, organization will be updated!`)

      const existingAttributes = await logExecutionTimeV2(
        async () => findOrgAttributes(qe, existing.id),
        log,
        'organizationService -> findOrCreateOrganization -> findOrgAttributes',
      )

      const processed = prepareOrganizationData(data, source, existing, existingAttributes)

      log.trace({ updateData: processed.organization }, `Updating organization!`)

      if (Object.keys(processed.organization).length > 0) {
        log.info({ orgId: existing.id }, `Updating organization!`)
        await logExecutionTimeV2(
          async () => updateOrganization(qe, existing.id, processed.organization),
          log,
          'organizationService -> findOrCreateOrganization -> updateOrganization',
        )
      }
      await logExecutionTimeV2(
        async () => upsertOrgIdentities(qe, existing.id, data.identities, integrationId),
        log,
        'organizationService -> findOrCreateOrganization -> upsertOrgIdentities',
      )
      await logExecutionTimeV2(
        async () => upsertOrgAttributes(qe, existing.id, processed.attributes),
        log,
        'organizationService -> findOrCreateOrganization -> upsertOrgAttributes',
      )
      for (const attr of processed.attributes) {
        if (attr.default) {
          await logExecutionTimeV2(
            async () => markOrgAttributeDefault(qe, existing.id, attr),
            log,
            'organizationService -> findOrCreateOrganization -> markOrgAttributeDefault',
          )
        }
      }

      id = existing.id
    } else {
      log.trace(`Organization wasn't found via website or identities.`)
      const displayName = data.displayName ? data.displayName : verifiedIdentities[0].value

      const payload = {
        displayName,
        description: data.description,
        logo: data.logo,
        tags: data.tags,
        employees: data.employees,
        location: data.location,
        type: data.type,
        size: data.size,
        headline: data.headline,
        industry: data.industry,
        founded: data.founded,
      }

      log.trace({ data, payload }, `Preparing payload to create a new organization!`)

      const processed = prepareOrganizationData(payload, source)

      log.trace({ payload: processed }, `Creating new organization!`)

      // if it doesn't exists create it
      id = await logExecutionTimeV2(
        async () => insertOrganization(qe, processed.organization),
        log,
        'organizationService -> findOrCreateOrganization -> insertOrganization',
      )

      await logExecutionTimeV2(
        async () => upsertOrgAttributes(qe, id, processed.attributes),
        log,
        'organizationService -> findOrCreateOrganization -> upsertOrgAttributes',
      )
      for (const attr of processed.attributes) {
        if (attr.default) {
          await logExecutionTimeV2(
            async () => markOrgAttributeDefault(qe, id, attr),
            log,
            'organizationService -> findOrCreateOrganization -> markOrgAttributeDefault',
          )
        }
      }

      // create identities
      for (const i of data.identities) {
        // add the identity
        await logExecutionTimeV2(
          async () =>
            addOrgIdentity(qe, {
              organizationId: id,
              platform: i.platform,
              type: i.type,
              value: i.value,
              verified: i.verified,
              sourceId: i.sourceId,
              integrationId,
            }),
          log,
          'organizationService -> findOrCreateOrganization -> addOrgIdentity',
        )
      }
    }

    return id
  } catch (err) {
    log.error(err, 'Error while upserting an organization!')
    throw err
  }
}
