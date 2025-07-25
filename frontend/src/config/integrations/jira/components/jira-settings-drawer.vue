<template>
  <app-drawer
    v-model="isVisible"
    custom-class="integration-jira-drawer"
    title="Jira"
    size="600px"
    pre-title="Integration"
    :show-footer="true"
    has-border
    @close="cancel"
  >
    <template #beforeTitle>
      <img class="min-w-6 h-6 mr-2" :src="logoUrl" alt="Jira logo" />
    </template>
    <template #content>
      <div class="w-full flex flex-col mb-6">
        <p class="text-[16px] font-semibold">
          Authentication
        </p>
        <div class="text-2xs text-gray-500 leading-normal mb-1">
          Connect a Jira endpoint. Provide a valid token if this jira endpoint
          requires it. (optional)
        </div>
      </div>

      <el-form label-position="top" class="form" @submit.prevent>
        <app-form-item
          class="mb-6"
          :validation="$v.jiraURL"
          label="Jira URL"
          :required="true"
          :error-messages="{
            required: 'This field is required',
          }"
        >
          <el-input v-model="form.jiraURL" @blur="onBlurJiraURL()" />
        </app-form-item>

        <el-divider />
        <div class="w-full flex flex-col mb-2">
          <div class="text-2xs text-gray-500">
            Provide a valid personal access token or username/API token
            combination
          </div>
        </div>
        <app-form-item class="mb-6" label="Personal Access Token">
          <el-input v-model="form.personalAccessToken" type="password" @blur="onBlurToken()">
            <template #suffix>
              <div
                v-if="isValidating"
                v-loading="isValidating"
                class="flex items-center justify-center w-6 h-6"
              />
            </template>
          </el-input>
        </app-form-item>

        <div class="mb-6 font-semibold">
          OR
        </div>

        <app-form-item class="mb-1" label="Jira username/email">
          <el-input v-model="form.username" @blur="onBlurToken()">
            <template #suffix>
              <div
                v-if="isValidating"
                v-loading="isValidating"
                class="flex items-center justify-center w-6 h-6"
              />
            </template>
          </el-input>
        </app-form-item>

        <app-form-item class="mb-1" label="API Token">
          <el-input v-model="form.apiToken" type="password" @blur="onBlurToken()">
            <template #suffix>
              <div
                v-if="isValidating"
                v-loading="isValidating"
                class="flex items-center justify-center w-6 h-6"
              />
            </template>
          </el-input>
        </app-form-item>

        <el-divider />
        <div class="w-full flex flex-col mb-6">
          <p class="text-[16px] font-semibold">
            Connect projects
          </p>
          <div class="text-2xs text-gray-500 leading-normal mb-1">
            Select which projects you want to track. All tickets avaliable in
            each project will be monitored.
          </div>
        </div>
        <div>
          <app-array-input
            v-for="(_, ii) of form.projects"
            :key="ii"
            v-model="form.projects[ii]"
            placeholder="Enter project key"
            :validation-function="validateGroup"
            :disabled="!isAPIConnectionValid"
          >
            <template #after>
              <lf-button
                type="primary-link"
                size="medium"
                class="w-10 h-10"
                icon-only
                @click="removeProject(ii)"
              >
                <lf-icon name="trash-can" :size="20" />
              </lf-button>
            </template>
          </app-array-input>

          <lf-button
            type="primary-link"
            @click="addProject()"
          >
            + Add project Key
          </lf-button>
        </div>
      </el-form>
    </template>

    <template #footer>
      <div>
        <lf-button
          type="secondary-gray"
          size="medium"
          class="mr-4"
          :disabled="loading"
          @click="cancel"
        >
          Cancel
        </lf-button>
        <lf-button
          id="jiraConnect"
          type="primary"
          size="medium"
          :disabled="$v.$invalid || !hasFormChanged || loading"
          :loading="loading"
          @click="connect"
        >
          {{ integration?.settings?.url ? "Update" : "Connect" }}
        </lf-button>
      </div>
    </template>
  </app-drawer>
</template>

<script setup lang="ts">
import useVuelidate from '@vuelidate/core';
import {
  computed, defineProps, onMounted, reactive, ref,
} from 'vue';
import jira from '@/config/integrations/jira/config';
import formChangeDetector from '@/shared/form/form-change';
import { mapActions } from '@/shared/vuex/vuex.helpers';
import AppArrayInput from '@/shared/form/array-input.vue';
import LfIcon from '@/ui-kit/icon/Icon.vue';
import { required } from '@vuelidate/validators';
import AppDrawer from '@/shared/drawer/drawer.vue';
import AppFormItem from '@/shared/form/form-item.vue';
import LfButton from '@/ui-kit/button/Button.vue';
// import elementChangeDetector from '@/shared/form/element-change';

const emit = defineEmits(['update:modelValue']);
const props = defineProps<{
  integration: any,
  modelValue: boolean,
  segmentId: string | null;
  grandparentId: string | null;
}>();

const loading = ref(false);
const form = reactive({
  jiraURL: '',
  apiToken: '',
  username: '',
  personalAccessToken: '',
  projects: [],
});

const rules = {
  jiraURL: {
    required,
  },
};

const isValidating = ref(false);
const isVerificationEnabled = ref(false);
const isAPIConnectionValid = ref(false);

const { hasFormChanged, formSnapshot } = formChangeDetector(form);
const $v = useVuelidate(rules, form, { $stopPropagation: true });

const { doJiraConnect } = mapActions('integration');
const isVisible = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit('update:modelValue', value);
  },
});
const logoUrl = jira.image;

onMounted(() => {
  if (props.integration?.settings?.url) {
    form.jiraURL = props.integration?.settings.url;
    form.personalAccessToken = props.integration?.settings.auth.personalAccessToken;
    form.username = props.integration?.settings.auth.username;
    form.apiToken = props.integration?.settings.auth.apiToken;
    form.projects = props.integration?.settings?.projects;
    isAPIConnectionValid.value = true;
  }
  formSnapshot();
});

const addProject = () => {
  form.projects.push('');
};

const removeProject = (index) => {
  form.projects.splice(index, 1);
};

const cancel = () => {
  isVisible.value = false;
};

const onBlurJiraURL = () => {
  $v.value.jiraURL.$touch();
  canVerify();
};

const canVerify = async () => {
  const isCorrect = await $v.value.$validate();
  if (isCorrect) {
    isVerificationEnabled.value = true;
  } else {
    isVerificationEnabled.value = false;
  }
};

const connect = async () => {
  loading.value = true;

  doJiraConnect({
    url: form.jiraURL,
    username: form.username,
    personalAccessToken: form.personalAccessToken,
    apiToken: form.apiToken,
    projects: form.projects,
    isUpdate: props.integration?.settings,
    segmentId: props.segmentId,
    grandparentId: props.grandparentId,
  })
    .then(() => {
      isVisible.value = false;
    })
    .finally(() => {
      loading.value = false;
    });
};
</script>

<script lang="ts">
export default {
  name: 'LfJiraSettingsDrawer',
};
</script>
