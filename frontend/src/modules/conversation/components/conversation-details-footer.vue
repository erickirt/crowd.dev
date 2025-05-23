<template>
  <app-conversation-footer-wrapper :conversation="conversation">
    <template
      #footer="{
        sourceId,
        attributes,
        replyContent,
      }"
    >
      <div
        class="flex items-center gap-3"
      >
        <div
          class="flex items-center tag h-8 !rounded-md"
        >
          <lf-icon name="user-group" class="mr-2 text-gray-400" />
          <p
            class="text-xs text-gray-900"
          >
            {{ pluralize('participant', conversation.memberCount, true) }}
          </p>
        </div>
        <div
          v-if="replyContent"
          class="flex items-center tag h-8 !rounded-md"
        >
          <lf-icon
            :name="replyContent.icon"
            size="16"
            class="mr-2 text-gray-400"
          />
          <p
            class="text-xs text-gray-900"
          >
            {{ pluralize(replyContent.copy, replyContent.number, true) }}
          </p>
        </div>
        <app-conversation-attributes
          v-if="!!platformConfig?.conversation?.attributes"
          :changes="footerContent().changes"
          :changes-copy="footerContent().changesCopy"
          :insertions="footerContent().insertions"
          :deletions="footerContent().deletions"
          :source-id="platformConfig?.activity?.showSourceId && sourceId"
          display="drawer"
          :display-source-id="conversation.conversationStarter?.type === 'authored-commit'"
        />
      </div>
      <div v-if="platformConfig?.conversation?.showLabels && attributes.labels?.length" class="mt-5">
        <div class="uppercase font-semibold text-2xs tracking-1 text-gray-400 mb-2">
          Labels
        </div>
        <div class="flex items-center flex-wrap gap-3">
          <div
            v-for="label in attributes.labels"
            :key="label"
            class="h-8 rounded-lg text-gray-900 border border-gray-200 bg-white text-xs flex items-center px-3"
          >
            {{ label }}
          </div>
        </div>
      </div>
    </template>
  </app-conversation-footer-wrapper>
</template>

<script setup>
import pluralize from 'pluralize';
import AppConversationFooterWrapper from '@/modules/conversation/components/conversation-footer-wrapper.vue';
import AppConversationAttributes from '@/modules/conversation/components/conversation-attributes.vue';
import { computed } from 'vue';
import { lfIdentities } from '@/config/identities';
import LfIcon from '@/ui-kit/icon/Icon.vue';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
});

const platformConfig = computed(() => lfIdentities[props.conversation.conversationStarter?.platform]);

const footerContent = () => {
  const { attributes } = props.conversation.conversationStarter;

  return platformConfig.value?.conversationDisplay?.attributes?.(attributes) || {};
};
</script>

<script>
export default {
  name: 'AppConversationParentFooter',
};
</script>
