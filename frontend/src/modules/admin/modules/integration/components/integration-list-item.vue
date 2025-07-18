<template>
  <article
    v-if="props.config"
    class="border border-gray-200 shadow-sm rounded-lg"
  >
    <div class="py-4 pl-4 pr-5 flex justify-between items-center">
      <!-- Info -->
      <div class="flex items-center gap-4">
        <div class=" h-12 w-12 border border-gray-200 rounded-md flex items-center justify-center">
          <div class="h-8 w-8">
            <img :src="props.config.image" :alt="props.config.name" class="object-contain w-full h-full" />
          </div>
        </div>
        <div>
          <h6 class="mb-0.5">
            {{ props.config.name }}
          </h6>
          <p class="text-gray-500 text-small">
            {{ props.config.description }}
          </p>
        </div>
      </div>

      <!-- Status -->
      <div v-if="integration && integration.status">
        <lf-integration-status :integration="integration" />
      </div>

      <!-- Connect component -->
      <div v-else class="flex items-center justify-end gap-4">
        <component
          :is="props.config.connectComponent"
          v-if="props.config.connectComponent && isComponentMounted"
          :integration="integration"
          :segment-id="route.params.id"
          :grandparent-id="route.params.grandparentId"
        />
      </div>
    </div>

    <div v-if="integration && integration.status" :class="status.actionBar.background">
      <div class="items-center py-2.5 px-4 flex justify-between">
        <!-- Custom content -->
        <div class="text-small flex items-center" :class="status.actionBar.color">
          <div v-if="isInProgress && !integration.isNango">
            <app-integration-progress-bar :progress="selectedProgress" :hide-bar="true" text-class="!text-secondary-500 text-small" />
          </div>
          <div v-else-if="hasError">
            {{ props.config.name }} integration failed to connect due to an API error.
          </div>

          <component
            :is="props.config.connectedParamsComponent"
            v-else-if="isComplete && props.config.connectedParamsComponent"
            :integration="integration"
            :segment-id="route.params.id"
            :grandparent-id="route.params.grandparentId"
          />

          <component
            :is="props.config.statusComponent"
            v-else-if="!isComplete && props.config.statusComponent"
            :integration="integration"
            :segment-id="route.params.id"
            :grandparent-id="route.params.grandparentId"
          />
          <p v-if="isComplete && integration.lastProcessedAt" class="text-small text-gray-500">
            <span v-if="props.config.connectedParamsComponent" class="font-semibold">&nbsp;&nbsp;•&nbsp;&nbsp;</span>
            Last data check completed {{ lastDataCheckCompleted }}
          </p>
        </div>

        <div class="flex items-center gap-4">
          <component
            :is="props.config.actionComponent"
            v-if="props.config.actionComponent"
            :integration="integration"
            :segment-id="route.params.id"
            :grandparent-id="route.params.grandparentId"
          />
          <lf-dropdown placement="bottom-end" width="14.5rem">
            <template #trigger>
              <lf-button type="secondary-ghost" icon-only>
                <lf-icon name="ellipsis" />
              </lf-button>
            </template>
            <component
              :is="props.config.dropdownComponent"
              v-if="props.config.dropdownComponent"
              :integration="integration"
              :segment-id="route.params.id"
              :grandparent-id="route.params.grandparentId"
              @open-setting="isSettingsOpen = true"
            />
            <lf-dropdown-item type="danger" @click="disconnectIntegration()">
              <lf-icon name="link-simple-slash" type="regular" />
              Disconnect integration
            </lf-dropdown-item>
          </lf-dropdown>
          <component
            :is="props.config.settingComponent"
            v-if="props.config.settingComponent"
            v-model="isSettingsOpen"
            :integration="integration"
            :segment-id="route.params.id"
            :grandparent-id="route.params.grandparentId"
          />
        </div>
      </div>
    </div>

    <component
      :is="props.config.mappedReposComponent"
      v-if="props.config.mappedReposComponent"
      :segment-id="route.params.id"
    />
  </article>
</template>

<script lang="ts" setup>
import { IntegrationConfig } from '@/config/integrations';
import { computed, onMounted, ref } from 'vue';
import { mapActions, mapGetters } from '@/shared/vuex/vuex.helpers';
import LfIntegrationStatus from '@/modules/admin/modules/integration/components/integration-status.vue';
import { getIntegrationStatus } from '@/modules/admin/modules/integration/config/status';
import LfDropdown from '@/ui-kit/dropdown/Dropdown.vue';
import LfButton from '@/ui-kit/button/Button.vue';
import LfIcon from '@/ui-kit/icon/Icon.vue';
import LfDropdownItem from '@/ui-kit/dropdown/DropdownItem.vue';
import AppIntegrationProgressBar from '@/modules/integration/components/integration-progress-bar.vue';
import { IntegrationProgress } from '@/modules/integration/types/IntegrationProgress';
import { EventType, FeatureEventKey } from '@/shared/modules/monitoring/types/event';
import useProductTracking from '@/shared/modules/monitoring/useProductTracking';
import { useRoute } from 'vue-router';
import { dateHelper } from '@/shared/date-helper/date-helper';

const props = defineProps<{
  config: IntegrationConfig,
  progress: IntegrationProgress | null,
  progressError: boolean
}>();

const route = useRoute();

const { doDestroy } = mapActions('integration');
const { findByPlatform } = mapGetters('integration');

const { trackEvent } = useProductTracking();

const integration = computed(() => findByPlatform.value(props.config.key));
const status = computed(() => getIntegrationStatus(integration.value));

const lastDataCheckCompleted = computed(() => {
  if (['github', 'gerrit', 'jira'].includes(integration.value.platform)) {
    return '1 hour ago';
  }

  if (integration.value.platform === 'git') {
    return '5 hours ago';
  }

  return dateHelper(integration.value.lastProcessedAt).fromNow();
});

const isInProgress = computed(() => integration.value.status === 'in-progress');
const hasError = computed(() => integration.value.status === 'error');
const isComplete = computed(() => integration.value.status === 'done');

const selectedProgress = computed(() => (props.progress || []).find((p) => p.platform === props.config.key));

const isComponentMounted = ref(false);
const isSettingsOpen = ref(false);

onMounted(() => {
  isComponentMounted.value = true;
});

const disconnectIntegration = () => {
  trackEvent({
    key: FeatureEventKey.DISCONNECT_INTEGRATION,
    type: EventType.FEATURE,
    properties: {
      platform: props.config.key,
    },
  });
  doDestroy(integration.value.id);
};
</script>

<script lang="ts">
export default {
  name: 'LfIntegrationListItem',
};
</script>
