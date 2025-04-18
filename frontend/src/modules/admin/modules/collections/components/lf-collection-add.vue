<template>
  <app-drawer
    v-model="model"
    :title="isEditForm ? 'Edit collection' : 'Add collection'"
    :size="600"
    @close="onCancel"
  >
    <template #content>
      <div
        v-if="loading"
        v-loading="loading"
        class="app-page-spinner h-16 !relative !min-h-5"
      />
      <div v-else>
        <lf-tabs v-model="activeTab" :fragment="false">
          <lf-tab name="details">
            Details
          </lf-tab>
          <lf-tab name="projects">
            Projects
          </lf-tab>
        </lf-tabs>
        <div class="pt-6 border-t border-gray-100">
          <div class="tab-content">
            <div v-if="activeTab === 'details'">
              <!-- Collection name -->
              <article class="mb-6">
                <lf-field label-text="Collection name" :required="true">
                  <lf-input
                    v-model="form.name"
                    class="h-10"
                    :invalid="$v.name.$invalid && $v.name.$dirty"
                    @blur="$v.name.$touch()"
                    @change="$v.name.$touch()"
                  />
                  <lf-field-messages
                    :validation="$v.name"
                    :error-messages="{ required: 'This field is required' }"
                  />
                </lf-field>
              </article>

              <!-- Description -->
              <article class="mb-6">
                <lf-field label-text="Description" :required="true">
                  <lf-textarea
                    v-model="form.description"
                    :invalid="$v.description.$invalid && $v.description.$dirty"
                    @blur="$v.description.$touch()"
                    @change="$v.description.$touch()"
                  />
                  <lf-field-messages
                    :validation="$v.description"
                    :error-messages="{ required: 'This field is required' }"
                  />
                </lf-field>
              </article>

              <!-- Description -->
              <article class="mb-5">
                <lf-field label-text="Category">
                  <div class="flex">
                    <div class="w-1/4">
                      <el-select
                        v-model="form.type"
                        placeholder="Select type"
                        class="w-full type-select"
                      >
                        <el-option label="Industry" value="vertical" />
                        <el-option label="Stack" value="horizontal" />
                      </el-select>
                    </div>
                    <div class="w-3/4">
                      <el-select
                        v-model="form.categoryId"
                        placeholder="Select type"
                        class="w-full category-select"
                        filterable
                        remote
                        :disabled="!form.type.length"
                        :remote-method="fetchCategories"
                      >
                        <el-option
                          v-if="collection"
                          :label="props.collection?.category.name"
                          :value="props.collection?.categoryId"
                          class="!px-3 !hidden"
                        />
                        <template v-for="group of categories" :key="group.id">
                          <div class="px-3 pt-1 text-xs font-semibold text-gray-400">
                            {{ group.name }}
                          </div>
                          <el-option
                            v-for="option of group.categories"
                            :key="option.id"
                            :label="option.name"
                            :value="option.id"
                            class="!px-3"
                          />
                        </template>
                      </el-select>
                    </div>
                  </div>
                  <lf-field-messages
                    :validation="$v.category"
                    :error-messages="{ required: 'This field is required' }"
                  />
                </lf-field>
              </article>
            </div>
            <lf-collection-add-projects-tab
              v-if="activeTab === 'projects'"
              :form="form"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <lf-button type="secondary-ghost" @click="onCancel">
        Cancel
      </lf-button>
      <lf-button
        type="primary"
        :disabled="!hasFormChanged || $v.$invalid || loading"
        @click="onSubmit"
      >
        {{ isEditForm ? "Update" : "Add collection" }}
      </lf-button>
    </template>
  </app-drawer>
</template>
<script setup lang="ts">
import formChangeDetector from '@/shared/form/form-change';
import useVuelidate from '@vuelidate/core';
import { required, maxLength } from '@vuelidate/validators';
import {
  computed, onMounted, reactive, ref, watch,
} from 'vue';
import LfButton from '@/ui-kit/button/Button.vue';
import LfTabs from '@/ui-kit/tabs/Tabs.vue';
import LfTab from '@/ui-kit/tabs/Tab.vue';
import LfInput from '@/ui-kit/input/Input.vue';
import LfTextarea from '@/ui-kit/textarea/Textarea.vue';
import LfField from '@/ui-kit/field/Field.vue';
import LfFieldMessages from '@/ui-kit/field-messages/FieldMessages.vue';
import Message from '@/shared/message/message';
import { CategoryGroup } from '@/modules/admin/modules/categories/types/CategoryGroup';
import { CategoryService } from '@/modules/admin/modules/categories/services/category.service';
import AppDrawer from '@/shared/drawer/drawer.vue';
import LfCollectionAddProjectsTab from './lf-collection-add-projects-tab.vue';
import {
  CollectionFormModel,
  CollectionModel,
} from '../models/collection.model';
import { InsightsProjectsService } from '../../insights-projects/services/insights-projects.service';
import { useInsightsProjectsStore } from '../../insights-projects/pinia';
import { CollectionsService } from '../services/collections.service';

const insightsProjectsStore = useInsightsProjectsStore();

const emit = defineEmits<{(e: 'update:modelValue', value: boolean): void;
  (e: 'onCollectionEdited'): void;
  (e: 'onCollectionCreated'): void;
}>();

const props = defineProps<{
  modelValue: boolean;
  collection?: CollectionModel;
}>();

const activeTab = ref('details');
const loading = ref(false);
const submitLoading = ref(false);
const form = reactive<CollectionFormModel>({
  name: '',
  description: '',
  type: '',
  categoryId: '',
  projects: [],
});

const rules = {
  name: {
    required,
    maxLength,
  },
  description: { required: (value: string) => value.trim().length },
  projects: { required: (value: any) => value.length > 0 },
  categoryId: {
    required,
  },
};

const $v = useVuelidate(rules, form);

const { hasFormChanged, formSnapshot } = formChangeDetector(form);

const model = computed({
  get() {
    return props.modelValue;
  },
  set(v) {
    emit('update:modelValue', v);
  },
});

const isEditForm = computed(() => !!props.collection?.id);

const fillForm = (record?: CollectionModel) => {
  if (record) {
    Object.assign(form, record);
    form.type = record.category.categoryGroupType;
    form.categoryId = record.categoryId || '';
  }

  formSnapshot();
};

onMounted(() => {
  InsightsProjectsService.list({}).then((response) => {
    insightsProjectsStore.setInsightsProjects(response.rows);
  });
  if (props.collection?.id) {
    loading.value = true;
    fillForm(props.collection);
    loading.value = false;
  } else {
    fillForm();
  }
});

const onCancel = () => {
  model.value = false;
};

const onSubmit = () => {
  submitLoading.value = true;
  const request = {
    name: form.name,
    description: form.description,
    projects: form.projects.map((project: any) => ({
      id: project.id,
      starred: project?.starred || false,
    })),
    isLF: true,
    categoryId: form.categoryId,
    slug: form.name.toLowerCase().replace(/ /g, '-'),
  };
  if (isEditForm.value) {
    handleCollectionUpdate(request);
  } else {
    handleCollectionCreate(request);
  }
};

const handleCollectionUpdate = (request: any) => {
  Message.info(null, {
    title: 'Collection is being updated',
  });
  CollectionsService.update(props.collection!.id, request)
    .then(() => {
      Message.closeAll();
      Message.success('Collection successfully updated');
      emit('onCollectionEdited');
    })
    .catch(() => {
      Message.closeAll();
      Message.error('Something went wrong');
    });
};

const handleCollectionCreate = (request: any) => {
  Message.info(null, {
    title: 'Collection is being created',
  });
  CollectionsService.create(request)
    .then(() => {
      Message.closeAll();
      Message.success('Collection successfully created');
      emit('onCollectionCreated');
    })
    .catch(() => {
      Message.closeAll();
      Message.error('Something went wrong');
    });
};

const categories = ref<CategoryGroup[]>([]);

const fetchCategories = (query: string) => {
  CategoryService.list({
    offset: 0,
    limit: 20,
    query,
    groupType: form.type,
  })
    .then((res) => {
      form.categoryId = !form.categoryId ? (props.collection?.categoryId || '') : form.categoryId;
      categories.value = res.rows;
    });
};

watch(
  () => form.type,
  () => {
    form.categoryId = '';
    fetchCategories('');
  },
);
</script>

<script lang="ts">
export default {
  name: 'LfCollectionAdd',
};
</script>

<style lang="scss">
.type-select{
  .el-input__wrapper{
    @apply rounded-r-none border-r-0 #{!important};
  }
}

.category-select{
  .el-input__wrapper{
    @apply rounded-l-none #{!important};
  }
}
</style>
