import pluralize from 'pluralize';
import { MemberService } from '@/modules/member/member-service';
import Errors from '@/shared/error/errors';
import { router } from '@/router';

import { ToastStore } from '@/shared/message/notification';
import { FormSchema } from '@/shared/form/form-schema';
import sharedActions from '@/shared/store/actions';
import { MemberModel } from '../member-model';

export default {
  ...sharedActions('member', MemberService),

  async doDestroyCustomAttributes({ commit, dispatch }, id) {
    try {
      const response = await MemberService.destroyCustomAttribute(id);

      dispatch('doFetchCustomAttributes');
    } catch (error) {
      Errors.handle(error);
    }
  },

  async doUpdateCustomAttributes({ commit, dispatch }, { id, data }) {
    try {
      const response = await MemberService.updateCustomAttribute(id, data);

      dispatch('doFetchCustomAttributes');
    } catch (error) {
      Errors.handle(error);
    }
  },

  async doFetchCustomAttributes({ commit }) {
    try {
      const response = await MemberService.fetchCustomAttributes();
    } catch (error) {
      Errors.handle(error);
    }
  },

  async doCreateCustomAttributes({ commit, dispatch }, values) {
    try {
      const response = await MemberService.createCustomAttributes(values);

      dispatch('doFetchCustomAttributes');

      return response;
    } catch (error) {
      if (error.response.status !== 500) {
        Errors.handle(error);
      }

      ToastStore.error('Custom Attributes could not be created');
    }
    return null;
  },

  async doMerge({ commit }, { memberToKeep, memberToMerge }) {
    try {
      await MemberService.merge(memberToKeep, memberToMerge);

      ToastStore.success('Profiles merged successfully');
      router.push(`/people/${memberToKeep.id}`);
    } catch (error) {
      Errors.handle(error);
    }
  },

  async doBulkUpdateMembersTags(
    { commit },
    {
      members, tagsInCommon, tagsToSave, segments,
    },
  ) {
    const { fields } = MemberModel;
    const formSchema = new FormSchema([
      fields.username,
      fields.info,
      fields.tags,
      fields.emails,
    ]);

    try {
      const payload = members.reduce((acc, item) => {
        const memberToUpdate = { ...item };
        const tagsToKeep = item.tags.filter(
          (tag) => tagsInCommon.filter((t) => t.id === tag.id).length === 0
            && tagsToSave.filter((t) => t.id === tag.id).length === 0,
        );

        memberToUpdate.tags = [...tagsToKeep, ...tagsToSave];
        acc.push(
          formSchema.cast({
            id: memberToUpdate.id,
            tags: memberToUpdate.tags,
          }),
        );
        return acc;
      }, []);
      const updatedMembers = await MemberService.updateBulk(payload, segments);
      ToastStore.success('Tags updated successfully');
      commit('BULK_UPDATE_MEMBERS_TAGS_SUCCESS', updatedMembers);
    } catch (error) {
      Errors.handle(error);
      ToastStore.error('There was an error updating tags');
    }
  },

  async doBulkUpdateMembersAttribute({ commit }, { members, attributesToSave }) {
    const { fields } = MemberModel;
    const formSchema = new FormSchema([
      fields.info,
      fields.joinedAt,
      fields.organizations,
      fields.attributes,
    ]);

    try {
      const payload = members.map((item) => {
        const memberToUpdate = { ...item };

        // 1. Update joinedAt
        if (attributesToSave.joinedAt) {
          memberToUpdate.joinedAt = attributesToSave.joinedAt;
        }

        // 2. Append Organizations
        if (attributesToSave.organizations) {
          const orgIdsInMember = memberToUpdate.organizations.map((org) => org.id);
          attributesToSave.organizations.forEach((org) => {
            // Only append if org is not already in member
            if (!orgIdsInMember.includes(org.id)) {
              memberToUpdate.organizations.push(org);
            }
          });
        }

        // 3. Update attributes
        if (attributesToSave.attributes) {
          Object.keys(attributesToSave.attributes).forEach((attributeName) => {
            const attributeValue = attributesToSave.attributes[attributeName];

            // If the attribute value is an array, then append the values and not overwrite them
            if (attributeValue && Array.isArray(attributeValue.default)) {
              memberToUpdate.attributes[attributeName] = memberToUpdate.attributes[attributeName] || { default: [] };

              // Get existing values of member attribute
              const existingValues = memberToUpdate.attributes[attributeName].default;

              // Append only the new values to the member attribute and not the existing ones
              const newValues = attributeValue.default.filter((value) => !existingValues.includes(value));
              memberToUpdate.attributes[attributeName].default.push(...newValues);
            } else if (attributeValue && typeof attributeValue.default !== 'undefined') {
              memberToUpdate.attributes[attributeName] = { default: attributeValue.default };
            }
          });
        }

        return formSchema.cast({
          id: memberToUpdate.id,
          joinedAt: memberToUpdate.joinedAt,
          organizations: memberToUpdate.organizations,
          attributes: memberToUpdate.attributes,
        });
      });

      const updatedMembers = await MemberService.updateBulk(payload);

      ToastStore.success('Attribute updated successfully');

      commit('UPDATE_SUCCESS', updatedMembers);
    } catch (error) {
      Errors.handle(error);
      ToastStore.error('There was an error updating attribute');
    }
  },

};
