/* eslint-disable @typescript-eslint/no-explicit-any */
import cloneDeep from 'lodash.clonedeep'
import merge from 'lodash.merge'

import { distinct, single } from '@crowd/common'
import { DbStore, RepositoryBase } from '@crowd/database'
import { ActivityDisplayService, DEFAULT_ACTIVITY_TYPE_SETTINGS } from '@crowd/integrations'
import { Logger } from '@crowd/logging'
import { IMemberIdentity, MemberIdentityType } from '@crowd/types'

import { IActivityData, IMemberData } from './types'

export class DataRepository extends RepositoryBase<DataRepository> {
  constructor(dbStore: DbStore, parentLog: Logger) {
    super(dbStore, parentLog)
  }

  async getActivities(activityIds: string[], loadChildTables = true): Promise<IActivityData[]> {
    const results = await this.db().any(
      `
    select a.id,
          a.type,
          a.timestamp,
          a.platform,
          a."isContribution",
          a.score,
          a."sourceId",
          a."sourceParentId",
          a.username,
          a."objectMemberUsername",
          a.attributes,
          a.channel,
          a.body,
          a.title,
          a.url,
          a.sentiment,
          a."organizationId",
          a."createdAt",
          a."memberId",
          a."segmentId",
          a."objectMemberId",
          a."conversationId",
          a."parentId",
          a."tenantId",
          a."createdById"
    from activities a
    where a.id in ($(activityIds:csv))
      and a."deletedAt" is null;
    `,
      {
        activityIds,
      },
    )
    const promises = []

    if (results.length === 0) {
      return []
    }

    promises.push(
      this.getActivityTypes(distinct(results.map((r) => r.tenantId))).then((types) => {
        for (const activity of results) {
          activity.display = ActivityDisplayService.getDisplayOptions(
            activity,
            types.get(activity.tenantId),
          )
        }
      }),
    )

    if (loadChildTables) {
      // load parent
      const parentActivityIds = results.filter((r) => r.parentId).map((r) => r.parentId)
      if (parentActivityIds.length > 0) {
        promises.push(
          this.getActivities(parentActivityIds, false).then((parents) => {
            for (const activity of results.filter((r) => r.parentId)) {
              activity.parent = single(parents, (p) => p.id === activity.parentId)
            }
          }),
        )
      }

      // load organizations
      const orgIds = results.filter((r) => r.organizationId).map((r) => r.organizationId)
      if (orgIds.length > 0) {
        promises.push(
          this.getOrganizations(orgIds).then((orgs) => {
            for (const activity of results.filter((r) => r.organizationId)) {
              activity.organization = single(orgs, (o) => o.id === activity.organizationId)
            }
          }),
        )
      }

      // load members and object members
      let memberIds = results.filter((r) => r.memberId).map((r) => r.memberId)
      memberIds = distinct(
        memberIds.concat(results.filter((r) => r.objectMemberId).map((r) => r.objectMemberId)),
      )
      if (memberIds.length > 0) {
        promises.push(
          this.getMembers(memberIds).then((members) => {
            for (const activity of results) {
              activity.member = single(members, (m) => m.id === activity.memberId)
              if (activity.objectMemberId) {
                activity.objectMember = single(members, (m) => m.id === activity.objectMemberId)
              }
            }
          }),
        )
      }

      await Promise.all(promises)
    }

    // calculate engagement
    if (loadChildTables) {
      for (const activity of results) {
        activity.engagement = activity.member.score || 0
      }
    }

    return results
  }

  public async getOrganizations(organizationIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select *
      from organizations
      where id in ($(organizationIds:csv)) and "deletedAt" is null
      `,
      {
        organizationIds,
      },
    )

    return results
  }

  async getMembers(memberIds: string[], loadChildTables = true): Promise<IMemberData[]> {
    const results = await this.db().any(
      `
    select
        m.id,
        m.attributes,
        m."displayName",
        m."joinedAt",
        m.reach,
        m.contributions,
        m."enrichedBy",
        m."manuallyCreated",
        m."createdAt",
        m."tenantId",
        m."createdById",
        m.score
    from members m
    where m.id in ($(memberIds:csv))
      and m."deletedAt" is null;
    `,
      {
        memberIds,
      },
    )

    const promises = []

    if (loadChildTables) {
      // load organizations
      promises.push(
        this.getMemberOrganizations(memberIds).then((orgs) => {
          for (const member of results) {
            member.organizations = orgs
              .filter((o) => o.memberId === member.id)
              .map((o) => {
                delete o.memberId
                return o
              })
          }
        }),
      )

      // load segments
      promises.push(
        this.getMemberSegments(memberIds).then((segments) => {
          for (const member of results) {
            member.segments = segments
              .filter((s) => s.memberId === member.id)
              .map((s) => {
                delete s.memberId
                return s
              })
          }
        }),
      )

      // load identities
      promises.push(
        this.getMemberIdentities(memberIds).then((allIdentities) => {
          for (const member of results) {
            const identities = allIdentities.filter((i) => i.memberId === member.id)

            // get all distinct platforms
            member.identities = distinct(identities.map((i) => i.platform))

            // construct username object
            member.username = {}
            for (const platform of member.identities) {
              member.username[platform] = identities
                .filter((i) => i.platform === platform && i.type === MemberIdentityType.USERNAME)
                .map((i) => i.value)
            }

            member.rawIdentities = identities
          }
        }),
      )

      // load activity aggregates
      promises.push(
        this.getMemberActivityAggregates(memberIds).then((aggs) => {
          for (const member of results) {
            const agg = single(aggs, (a) => a.memberId === member.id)
            delete agg.memberId
            Object.assign(member, agg)
          }
        }),
      )

      // load last activity
      const lastActivityIds = results.filter((r) => r.lastActivityId).map((r) => r.lastActivityId)
      if (lastActivityIds.length > 0) {
        promises.push(
          this.getActivities(lastActivityIds, false).then((activities) => {
            for (const member of results.filter((r) => r.lastActivityId)) {
              member.lastActivity = single(activities, (a) => a.id === member.lastActivityId)
            }
          }),
        )
      }

      // load tags
      promises.push(
        this.getMemberTags(memberIds).then((tags) => {
          for (const member of results) {
            member.tags = tags
              .filter((t) => t.memberId === member.id)
              .map((t) => {
                delete t.memberId
                return t
              })
          }
        }),
      )

      // load no merge
      promises.push(
        this.getMemberNoMerge(memberIds).then((noMerges) => {
          for (const member of results) {
            member.noMerge = noMerges
              .filter((n) => n.memberId === member.id)
              .map((n) => n.noMergeId)
          }
        }),
      )

      // load to merge
      promises.push(
        this.getMemberToMerge(memberIds).then((toMerges) => {
          for (const member of results) {
            member.toMerge = toMerges
              .filter((n) => n.memberId === member.id)
              .map((n) => n.toMergeId)
          }
        }),
      )

      // load affiliations
      promises.push(
        this.getMemberAffiliations(memberIds).then((affiliations) => {
          for (const member of results) {
            member.affiliations = affiliations
              .filter((a) => a.memberId === member.id)
              .map((a) => {
                delete a.memberId
                return a
              })
          }
        }),
      )
    }

    await Promise.all(promises)

    return results
  }

  async getMemberActivityAggregates(memberIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select  "memberId",
              (select id
                from activities a2
                where a2."memberId" = activities."memberId"
                order by timestamp desc
                limit 1)                                                                          as "lastActiveId",
              max(timestamp)                                                                      as "lastActive",
              count(id)                                                                           as "activityCount",
              array_agg(distinct concat(platform, ':', type)) filter (where platform is not null) as "activityTypes",
              array_agg(distinct platform) filter (where platform is not null)                    as "activeOn",
              count(distinct "timestamp"::date)                                                   as "activeDaysCount",
              round(avg(
                            case
                                when (sentiment ->> 'sentiment'::text) is not null then
                                    (sentiment ->> 'sentiment'::text)::double precision
                                else
                                    null::double precision
                                end
                    )::numeric, 2)                                                                as "averageSentiment"
        from activities
        where "memberId" in ($(memberIds:csv))
          and "deletedAt" is null
        group by "memberId";
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getMemberAffiliations(memberIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select  msa."memberId",
              msa.id,
              s.id            as "segmentId",
              s.slug          as "segmentSlug",
              s.name          as "segmentName",
              s."parentName"  as "segmentParentName",
              o.id            as "organizationId",
              o."displayName" as "organizationName",
              o.logo          as "organizationLogo",
              msa."dateStart" as "dateStart",
              msa."dateEnd"   as "dateEnd"
        from "memberSegmentAffiliations" msa
                left join organizations o on o.id = msa."organizationId"
                join segments s on s.id = msa."segmentId"
        where msa."memberId" in ($(memberIds:csv))
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getMemberToMerge(memberIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select "memberId", "toMergeId"
      from "memberToMerge"
      where "memberId" in ($(memberIds:csv));
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getMemberNoMerge(memberIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select "memberId", "noMergeId"
      from "memberNoMerge"
      where "memberId" in ($(memberIds:csv));
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getMemberTags(memberIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select mt."memberId", t.*
      from "memberTags" mt
              inner join tags t on t.id = mt."tagId"
      where mt."memberId" in ($(memberIds:csv))
        and t."deletedAt" is null;
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getMemberIdentities(memberIds: string[]): Promise<IMemberIdentity[]> {
    const results = await this.db().any(
      `
      select * from "memberIdentities"
      where "memberId" in ($(memberIds:csv));
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getMemberOrganizations(memberIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select mo."memberId", o.*
      from organizations o
               inner join "memberOrganizations" mo on mo."organizationId" = o.id
      where mo."memberId" in ($(memberIds:csv))
        and mo."deletedAt" is null
        and o."deletedAt" is null;
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getMemberSegments(memberIds: string[]): Promise<any[]> {
    const results = await this.db().any(
      `
      select ms."memberId", s.* from segments s 
      inner join "memberSegments" ms on s.id = ms."segmentId"
      where ms."memberId" in ($(memberIds:csv));
      `,
      {
        memberIds,
      },
    )

    return results
  }

  async getActivityTypes(tenantIds: string[]): Promise<Map<string, any>> {
    const results = await this.db().any(
      `select "tenantId", "customActivityTypes" from segments where "tenantId" in ($(tenantIds:csv));`,
      {
        tenantIds,
      },
    )

    const map = new Map<string, any>()

    for (const tenantId of tenantIds) {
      const res: Record<string, unknown> = {}

      res.default = cloneDeep(DEFAULT_ACTIVITY_TYPE_SETTINGS)

      let customActivityTypes = {}
      for (const result of results.filter((r) => r.tenantId === tenantId)) {
        customActivityTypes = merge(customActivityTypes, result.customActivityTypes)
      }

      if (Object.keys(customActivityTypes).length > 0) {
        res.custom = customActivityTypes
      } else {
        res.custom = {}
      }

      map.set(tenantId, res)
    }

    return map
  }
}
