import type { PageSchema } from 'jamis';
import { pb } from '../libs/pocketbase';
import { CRUD_GROUP_PROJECTS } from './group-projects';
import { SERVICE_GROUP_MEMBERS } from './group-members';
import { SERVICE_GROUP_ACTIVITY } from './group-activity';
import { FORM_GROUP_SETTING } from './group-setting';
import { GroupNewForm } from './group-new-form';

export const PageGroup: PageSchema = {
  type: 'page',
  id: 'groupPageId',
  initApi: {
    url: '',
    trackExpression: '${groupId}',
    fetcherProvider: async (ctx, api) => {
      const groups =
        Array.isArray(ctx.groups) && ctx.groups.length
          ? ctx.groups
          : await pb.collection('groups').getFullList({
              sort: 'type,-updated'
            });
      const currentGroup = groups.find(
        (item) => item.id === ctx.groupId || item.yid === ctx.groupId
      );

      const result = {
        code: 0,
        data:
          Array.isArray(ctx.groups) && ctx.groups.length
            ? {
                currentGroup
              }
            : {
                groups,
                currentGroup,
                navs: groups.map((item) => ({
                  label: item.type === 'private' ? '个人空间' : item.name,
                  value: item.id,
                  icon:
                    item.type === 'private'
                      ? 'UserOutlined'
                      : 'FolderOpenOutlined',
                  to: `/group/${item.id}`
                }))
              }
      };
      console.log('🚀 ~ PageGroup ~ fetcherProvider: ~ groups:', groups.length);
      if (!ctx.groupId && groups.length) {
        amisEnv.jumpTo(`/group/${groups[0].id}`);
        return result;
      }

      return result;
    }
  },
  aside: [
    {
      type: 'wrapper',
      className: 'bg-gray-600 text-white rounded-t-md',
      body: [
        {
          type: 'flex',
          className: 'justify-between',
          body: [
            '${currentGroup.group_name}',
            {
              type: 'action',
              actionType: 'dialog',
              icon: 'FolderAddOutlined',
              dialog: {
                title: '添加分组',
                body: GroupNewForm
              }
            }
          ]
        },
        {
          type: 'tpl',
          tpl: '简介: ${currentGroup.group_desc}'
        },
        {
          type: 'input-text',
          name: 'searchGroupText',
          placeholder: '搜索分类'
        }
      ]
    },
    {
      type: 'nav',
      stacked: true,
      source: '${navs}'
    }
  ],
  body: [
    {
      type: 'tabs',
      tabsMode: 'card',
      tabs: [
        {
          title: '项目列表',
          body: CRUD_GROUP_PROJECTS
        },
        {
          title: '成员列表',
          body: SERVICE_GROUP_MEMBERS,
          visibleOn: '${currentGroup.type === "public"}'
        },
        {
          title: '分组动态',
          body: SERVICE_GROUP_ACTIVITY
        },
        {
          title: '分组设置',
          visibleOn: '${currentGroup.type === "public"}',
          body: FORM_GROUP_SETTING
        }
      ]
    }
  ]
};
