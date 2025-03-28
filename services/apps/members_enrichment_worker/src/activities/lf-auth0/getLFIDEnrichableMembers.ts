import { fetchMembersForLFIDEnrichment } from '@crowd/data-access-layer/src/old/apps/members_enrichment_worker'
import { IMember } from '@crowd/types'

import { svc } from '../../service'

export async function getLFIDEnrichableMembers(limit: number, afterId: string): Promise<IMember[]> {
  let rows: IMember[] = []

  try {
    const db = svc.postgres.reader
    rows = await fetchMembersForLFIDEnrichment(db, limit, afterId)
  } catch (err) {
    throw new Error(err)
  }

  return rows
}
