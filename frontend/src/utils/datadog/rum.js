import { datadogRum } from '@datadog/browser-rum';
import config from '@/config';

export function initRUM() {
  datadogRum.init({
    applicationId: config.datadog.rum.applicationId,
    clientToken: config.datadog.rum.clientToken,
    site: 'datadoghq.com',
    service: 'lfx-cm-(crowd)',
    env: 'dev',
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'allow',
  });
}

export function setRumUser(user) {
  datadogRum.setUser({
    id: user['https://sso.linuxfoundation.org/claims/username'],
    email: user.email,
    name: user.name,
  });
}
