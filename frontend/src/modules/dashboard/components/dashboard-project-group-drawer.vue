<template>
  <app-drawer
    v-model="model"
    title="All projects"
    :pre-title="projectGroup.name"
    has-border
    :show-footer="false"
    :size="600"
    @close="model = false"
  >
    <template #content>
      <div class="flex flex-col h-full">
        <app-lf-search-input
          placeholder="Search projects..."
          @on-change="onSearchProjects"
        />

        <div
          v-if="loading && !pagination.count"
          v-loading="loading"
          class="app-page-spinner h-16 !relative !min-h-5 mt-10"
        />
        <div v-else-if="projectsList.length" class="mt-4 -mx-6 overflow-auto">
          <el-collapse
            v-for="project in projectsList"
            :key="project.id"
            v-model="openedProject"
            class="custom-collapse-project-groups"
            accordion
          >
            <el-collapse-item
              :name="project.name"
              :disabled="!project.subprojects.length"
            >
              <template #title>
                <div
                  class="flex flex-grow items-center justify-between gap-2 px-6"
                >
                  <div class="flex items-center gap-4">
                    <lf-icon
                      v-if="project.subprojects.length"
                      name="chevron-down"
                      :size="20"
                      class="text-black"
                      :class="{
                        'rotate-180': openedProject === project.name,
                      }"
                    />
                    <div v-else class="w-5 h-5" />
                    <div>
                      <div class="text-gray-900 font-medium text-sm leading-5">
                        {{ project.name }}
                      </div>
                      <div class="text-3xs text-gray-500 leading-4">
                        <span v-if="project.subprojects.length">
                          {{
                            pluralize(
                              'sub-project',
                              project.subprojects.length,
                              true,
                            )
                          }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <div @click="onChildrenClick(project.name)">
                <div
                  v-for="subproject in project.subprojects"
                  :key="subproject.id"
                  class="pl-[60px] pr-6 h-16 flex items-center border-b last:border-b-0 border-gray-200"
                >
                  <div class="flex flex-grow items-center justify-between gap-2">
                    <div class="text-xs text-gray-900 font-medium leading-5">
                      {{ subproject.name }}
                    </div>

                    <div
                      v-if="subproject.integrations?.length"
                      class="flex gap-3 items-center"
                    >
                      <div
                        v-for="{
                          id,
                          platform,
                          status,
                          type,
                        } in subproject.integrations"
                        :key="id"
                        class="relative w-6 h-6 flex items-center justify-center"
                      >
                        <app-platform-svg
                          :platform="platform"
                          :color="
                            platform === 'github' && type === 'mapped'
                              ? 'gray'
                              : 'black'
                          "
                        />
                        <lf-icon
                          v-if="status === 'no-data'"
                          name="triangle-exclamation"
                          :size="12"
                          type="solid"
                          class="absolute right-0 top-0 leading-3 text-yellow-500"
                        />
                        <lf-icon
                          v-else-if="status === 'error'"
                          name="circle-exclamation"
                          :size="12"
                          type="solid"
                          class="absolute right-0 top-0 leading-3 text-red-600"
                        />
                      </div>
                    </div>
                    <div
                      v-else
                      class="text-xs italic leading-4 text-gray-400 text-right"
                    >
                      No connected integrations yet
                    </div>
                  </div>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>

          <!-- Load more button -->
          <div v-if="!isLoadMoreVisible" class="flex grow justify-center mt-8">
            <div
              v-if="loading"
              v-loading="loading"
              class="app-page-spinner h-16 w-16 !relative !min-h-fit"
            />
            <lf-button v-else type="primary-link" @click="onLoadMore">
              <lf-icon name="arrow-down" :size="14" />
              <span class="text-xs">Load more</span>
            </lf-button>
          </div>
        </div>
        <app-empty-state
          v-else
          class="mt-4"
          icon="fa-light fa-layer-group"
          description="No projects found"
        />
      </div>
    </template>
  </app-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppLfSearchInput from '@/modules/admin/modules/projects/components/view/lf-search-input.vue';
import { LfService } from '@/modules/lf/segments/lf-segments-service';
import pluralize from 'pluralize';
import AppPlatformSvg from '@/shared/modules/platform/components/platform-svg.vue';
import useProductTracking from '@/shared/modules/monitoring/useProductTracking';
import {
  EventType,
  FeatureEventKey,
} from '@/shared/modules/monitoring/types/event';
import LfIcon from '@/ui-kit/icon/Icon.vue';
import LfButton from '@/ui-kit/button/Button.vue';
import { Project } from '@/modules/lf/segments/types/Segments';

const emit = defineEmits(['update:isVisible']);
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true,
  },
  projectGroup: {
    type: Object,
    default: () => {},
  },
});

const model = computed({
  get() {
    return props.isVisible;
  },
  set(v) {
    emit('update:isVisible', v);
  },
});

const searchQuery = ref('');
const loading = ref(false);
const openedProject = ref();
const pagination = ref({
  pageSize: 20,
  currentPage: 1,
  count: 0,
});
const projectsList = ref<Project[]>([]);

const offset = computed(() => {
  const { currentPage } = pagination.value;

  return (currentPage - 1) * pagination.value.pageSize;
});

const isLoadMoreVisible = computed(
  () => pagination.value.currentPage * pagination.value.pageSize
      >= pagination.value.count || loading.value,
);

const { trackEvent } = useProductTracking();

const listProjects = (clearList?: boolean) => {
  loading.value = true;

  LfService.queryProjects({
    limit: pagination.value.pageSize,
    offset: offset.value,
    filter: {
      name: searchQuery.value,
      parentSlug: props.projectGroup.slug,
    },
  })
    .then((response) => {
      pagination.value.count = response.count;

      if (clearList) {
        projectsList.value = response.rows;
      } else {
        projectsList.value = projectsList.value.concat(response.rows);
      }
    })
    .finally(() => {
      loading.value = false;
    });
};

const onSearchProjects = (query: string) => {
  trackEvent({
    key: FeatureEventKey.SEARCH_PROJECTS,
    type: EventType.FEATURE,
  });

  searchQuery.value = query;
  pagination.value = {
    pageSize: 20,
    currentPage: 1,
    count: 0,
  };

  listProjects(true);
};

const onLoadMore = () => {
  pagination.value.currentPage += 1;

  listProjects();
};

onMounted(() => {
  listProjects();
});

const onChildrenClick = (projectName: string) => {
  if (openedProject.value === projectName) {
    openedProject.value = null;
  }
};
</script>

<script lang="ts">
export default {
  name: 'AppDashboardProjectGroupDrawer',
};
</script>

<style lang="scss">
.el-collapse.custom-collapse-project-groups {
  @apply border-t-0 bg-white hover:bg-gray-50 hover:cursor-pointer;

  .el-collapse-item.is-active {
    @apply bg-gray-50;

    .el-collapse-item__wrap {
      @apply border-b-0;
    }
  }

  .el-collapse-item__header {
    @apply h-16 bg-transparent border-gray-200;

    &.is-active {
      @apply border-b-0;
    }
    .el-icon {
      @apply hidden;
    }
  }

  .el-collapse-item__wrap {
    @apply bg-transparent;
  }

  .el-collapse-item__content {
    @apply pb-0 bg-transparent;
  }
}
</style>
