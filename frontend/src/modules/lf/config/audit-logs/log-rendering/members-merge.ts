import { LogRenderingConfig } from '@/modules/lf/config/audit-logs/log-rendering/index';

const membersMerge: LogRenderingConfig = {
  label: 'Contributors merged',
  changes: (log) => {
    const primary = log.oldState?.primary;
    const secondary = log.oldState?.secondary;
    const merged = log.newState?.primary;
    return {
      removals: merged ? [
        `${primary?.displayName}<span> ・ ID: ${primary?.id}</span>`,
        `${secondary?.displayName}<span> ・ ID: ${secondary?.id}</span>`,
      ] : [],
      additions: merged ? [
        `${merged?.displayName || primary?.displayName}<span> ・ ID: ${merged?.id || primary?.id}</span>`,
      ] : [],
      changes: [],
    };
  },
  description: (log) => {
    const contributor = log.newState?.primary?.displayName || log.oldState?.primary?.displayName;
    if (contributor) {
      return `${contributor}<br>ID: ${log.entityId}`;
    }
    return '';
  },
  properties: (log) => {
    const contributor = log.newState?.primary?.displayName || log.oldState?.primary?.displayName;
    if (contributor) {
      return [{
        label: 'Contributor',
        value: `${contributor}<br><span>ID: ${log.entityId}</span>`,
      }];
    }
    return [];
  },
};

export default membersMerge;