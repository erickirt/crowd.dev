<template>
  <app-drawer
    v-model="isDrawerVisible"
    title="GitHub"
    size="600px"
    pre-title="Integration"
    :show-footer="true"
    has-border
    @close="isDrawerVisible = false"
  >
    <template #beforeTitle>
      <img
        :src="githubDetails.image"
        class="min-w-6 h-6 mr-2"
        alt="GitHub logo"
      />
    </template>
    <template #content>
      <div>
        <!-- Connected organization info -->
        <section
          v-if="owner"
          class="border border-gray-200 rounded-md py-4 px-5 mb-6"
        >
          <p class="text-2xs font-medium text-gray-400 mb-1">
            Connected organization
          </p>
          <div class="flex items-center">
            <div
              v-if="owner.logo"
              class="h-5 w-5 rounded border border-gray-200 mr-2"
            >
              <img
                :src="owner.logo"
                class="min-w-5 object-cover"
                :alt="owner.logo"
              />
            </div>
            <p class="text-xs font-medium leading-5">
              {{ owner.name }}
            </p>
          </div>
        </section>

        <!-- Disclaimer -->
        <section class="pb-4">
          <div class="pb-4">
            <div class="flex justify-between items-center">
              <h6 class="text-sm font-medium leading-5 mb-2">
                Repository mapping
              </h6>
              <div
                class="flex items-center text-primary-500 cursor-pointer select-none"
                @click="isBulkSelectOpened = true"
              >
                <lf-icon name="check-double" :size="16" class="mr-1" />
                <span class="text-xs font-normal"> Bulk selection </span>
              </div>
            </div>
            <p class="text-2xs leading-4.5 text-gray-500">
              Select the subproject you want to map with each connected
              repository.
            </p>
          </div>
          <div
            class="border border-yellow-100 rounded-md bg-yellow-50 p-2 flex"
          >
            <lf-icon
              name="triangle-exclamation"
              type="solid"
              :size="16"
              class="text-yellow-500"
            />
            <div class="flex-grow text-yellow-900 text-2xs leading-4.5 pl-2">
              Repository mapping is not reversible. Once GitHub is connected,
              you won’t be able to update these settings and reconnecting a
              different organization or repositories won’t override past
              activities.
            </div>
          </div>
        </section>

        <section class="pb-4">
          <el-input
            v-model="search"
            clearable
            placeholder="Search repositories..."
          >
            <template #prefix>
              <lf-icon name="magnifying-glass" class="text-gray-400" />
            </template>
          </el-input>
        </section>

        <!-- Repository mapping -->
        <section v-if="filteredRepos.length > 0">
          <div class="flex border-b border-gray-200 items-center h-8">
            <div class="w-1/2 pr-4">
              <p
                class="text-3xs uppercase text-gray-400 font-semibold tracking-1"
              >
                REPOSITORY
              </p>
            </div>
            <div class="w-1/2 pr-4">
              <p
                class="text-3xs uppercase text-gray-400 font-semibold tracking-1"
              >
                SUB-PROJECT
              </p>
            </div>
          </div>
          <div v-if="!loading" class="py-1.5">
            <article
              v-for="repo of filteredRepos"
              :key="repo.url"
              class="py-1.5 flex items-center"
            >
              <div class="w-1/2 flex items-center pr-4">
                <lf-svg name="git-repository" class="w-4 h-4 mr-2" />
                <p class="text-2xs leading-5 flex-grow truncate">
                  /{{ repo.name }}
                </p>
              </div>
              <div class="w-1/2">
                <app-form-item
                  :validation="$v[repo.url]"
                  :error-messages="{
                    required: 'This field is required',
                  }"
                  class="mb-0"
                  error-class="relative top-0"
                >
                  <el-select
                    v-model="form[repo.url]"
                    placeholder="Select sub-project"
                    class="w-full"
                    placement="bottom-end"
                    filterable
                    @blur="$v[repo.url].$touch"
                    @change="$v[repo.url].$touch"
                  >
                    <el-option
                      v-for="subproject of subprojects"
                      :key="subproject.id"
                      :value="subproject.id"
                      :label="subproject.name"
                    />
                  </el-select>
                </app-form-item>
              </div>
            </article>
          </div>
          <div v-if="loading" class="flex justify-center py-4">
            <lf-icon
              name="spinner"
              type="solid"
              :size="16"
              class="text-gray-400 animate-spin"
            />
          </div>
        </section>
        <section v-else>
          <p class="text-center text-sm text-gray-500 mb-4">
            No repositories found
          </p>
        </section>
      </div>
    </template>

    <template #footer>
      <div style="flex: auto">
        <lf-button
          type="bordered"
          size="medium"
          class="mr-3"
          @click="isDrawerVisible = false"
        >
          Cancel
        </lf-button>
        <lf-button
          type="primary"
          size="medium"
          :disabled="sending || $v.$invalid"
          :loading="sending"
          @click="connect()"
        >
          Connect
        </lf-button>
      </div>
    </template>
  </app-drawer>
  <app-github-settings-bulk-select
    v-model="isBulkSelectOpened"
    :repositories="repos"
    :subprojects="subprojects"
    @apply="bulkApply"
  />
</template>

<script lang="ts" setup>
import {
  computed, h, onMounted, ref,
} from 'vue';
import { ToastStore } from '@/shared/message/notification';
import github from '@/config/integrations/github/config';
import { LfService } from '@/modules/lf/segments/lf-segments-service';
import { useRoute, useRouter } from 'vue-router';
import { required } from '@vuelidate/validators';
import useVuelidate from '@vuelidate/core';
import AppFormItem from '@/shared/form/form-item.vue';
import { IntegrationService } from '@/modules/integration/integration-service';
import ConfirmDialog from '@/shared/dialog/confirm-dialog';
import { mapActions } from '@/shared/vuex/vuex.helpers';
import { showIntegrationProgressNotification } from '@/modules/integration/helpers/integration-progress-notification';
import useProductTracking from '@/shared/modules/monitoring/useProductTracking';
import {
  EventType,
  FeatureEventKey,
} from '@/shared/modules/monitoring/types/event';
import { Platform } from '@/shared/modules/platform/types/Platform';
import AppGithubSettingsBulkSelect from '@/config/integrations/github/components/settings/github-settings-bulk-select.vue';
import LfSvg from '@/shared/svg/svg.vue';
import LfIcon from '@/ui-kit/icon/Icon.vue';
import LfButton from '@/ui-kit/button/Button.vue';
import { ProjectGroup, SubProject } from '@/modules/lf/segments/types/Segments';

const props = defineProps<{
  modelValue: boolean;
  integration: any;
}>();

const emit = defineEmits<{(e: 'update:modelValue', value: boolean): void }>();

const { trackEvent } = useProductTracking();

const route = useRoute();
const router = useRouter();

// Store
const { doFetch } = mapActions('integration');

// Drawer visibility
const isDrawerVisible = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit('update:modelValue', val);
  },
});

// Search
const search = ref('');

const filteredRepos = computed(() => repos.value.filter((r: any) => r.name.toLowerCase().includes(search.value.toLowerCase())));

// Bulk select
const isBulkSelectOpened = ref<boolean>(false);

const bulkApply = (data: Record<string, string>) => {
  form.value = {
    ...form.value,
    ...data,
  };
};

// Display data
const repos = computed(() => props.integration?.settings?.orgs[0]?.repos || []);

const owner = computed<{ name: string; logo?: string } | null>(() => (repos.value.length > 0
  ? {
    name: props.integration?.settings?.orgs[0]?.name,
    logo: props.integration?.settings?.orgs[0]?.logo,
  }
  : null));

// Static github details
const githubDetails = computed(() => github);

// Form
const form = ref<Record<string, string>>(
  repos.value.reduce(
    (a: Record<string, any>, b: any) => ({
      ...a,
      [b.url]: props.integration.segmentId,
    }),
    {},
  ),
);

const rules = computed(() => repos.value.reduce(
  (a: Record<string, any>, b: any) => ({
    ...a,
    [b.url]: {
      required,
    },
  }),
  {},
));

const $v = useVuelidate(rules, form);

// Connecting
const sending = ref(false);

const connect = () => {
  const data = { ...form.value };
  ConfirmDialog({
    type: 'warning',
    title: 'Are you sure you want to proceed?',
    message:
      'Repository mapping is not reversible. Once GitHub is connected, you wont be able to update these settings.\n\n'
      + 'Reconnecting a different organization and/or repositories won’t remove past activities. '
      + 'In order to clean up existing data please reach out to our support team.',
    confirmButtonText: 'Connect GitHub',
    cancelButtonText: 'Cancel',
    icon: 'fa-triangle-exclamation fa-light',
  } as any).then(() => {
    IntegrationService.githubMapRepos(props.integration.id, data, [
      props.integration.segmentId,
    ])
      .then(() => {
        isDrawerVisible.value = false;

        doFetch([props.integration.segmentId]);

        trackEvent({
          key: FeatureEventKey.CONNECT_INTEGRATION,
          type: EventType.FEATURE,
          properties: {
            integration: Platform.GITHUB,
          },
        });

        showIntegrationProgressNotification(
          'github',
          props.integration.segmentId,
        );

        router.push({
          name: 'integration',
          params: {
            id: props.integration.segmentId,
          },
        });
      })
      .catch((error) => {
        handleMessage(error);
      });
  });
};

const handleMessage = (error: any) => {
  const errorMessage = error?.response?.data;

  const pattern = /github repo (?<repo>[^\s]+) mapping with integrationId (?<IId>[^\s]+) but it is already mapped to integration (?<eId>[^\s!]+)/;
  const match = errorMessage.match(pattern);

  if (match?.groups) {
    const { repo, eId } = match.groups;
    IntegrationService.find(eId)
      .then((integration) => {
        customErrorMessage(integration.segment, repo);
      })
      .catch(() => {
        ToastStore.error(errorMessage);
      });
  } else {
    ToastStore.error('There was an error mapping github repos');
  }
};

const customErrorMessage = (segment: any, githubRepo: string) => {
  ToastStore.error(
    h(
      'span',
      {
        class: 'whitespace-normal',
      },
      [
        'The github repo',
        ' ',
        h('strong', githubRepo),
        ' ',
        'is already connected with project',
        ' ',
        h(
          'a',
          {
            href: getSegmentLink(segment),
            class: 'text-blue-500 underline hover:text-blue-600',
          },
          segment.name || 'Unknown Project',
        ),
      ],
    ),
    {
      title: 'Conflict Detected',
    },
  );
};

const getSegmentLink = (segment: any) => `/integrations/${segment.grandparentId}/${segment.id}`;

// Fetching subprojects
const subprojects = ref<SubProject[]>([]);
const loading = ref(false);

const fetchSubProjects = () => {
  loading.value = true;
  LfService.findSegment(route.params.grandparentId)
    .then((segment: ProjectGroup) => {
      subprojects.value = segment.projects
        .map((p) => p.subprojects)
        .flat()
        .filter((s) => s !== undefined);
    })
    .catch(() => {
      ToastStore.error('There was an error fetching subprojects');
    })
    .finally(() => {
      loading.value = false;
    });
};

onMounted(() => {
  fetchSubProjects();
});
</script>

<script lang="ts">
export default {
  name: 'AppGithubSettingsDrawer',
};
</script>
