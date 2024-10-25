import type { FlexSchema } from 'jamis';
import { pb } from '../libs/pocketbase';

export const SCHEMA_HEADER: FlexSchema = {
  type: 'flex',
  visibleOn: '${!CONTAINS(pathname, "^(/login|/register|/user/profile)")}',
  className: ['w-full mr-6 gap-x-3 justify-between'],
  body: [
    {
      type: 'service',
      visibleOn: '${!!projectId || !!groupId}',
      className: 'font-bold',
      api: {
        url: '',
        trackExpression: '${projectId}${groupId}',
        async fetcherProvider(ctx) {
          const result = {
            projectName: '',
            groupName: ''
          };
          if (ctx.projectId) {
            const project = await pb
              .collection('projects')
              .getOne(ctx.projectId, {
                expand: 'groupId'
              });
            result.projectName = project.name;
            result.groupName = project.expand?.groupId?.name;
          } else if (ctx.groupId) {
            const group = await pb.collection('groups').getOne(ctx.groupId);
            result.groupName = group.name;
          }

          return result;
        }
      },
      body: [
        {
          type: 'button',
          label: '${groupName}',
          level: 'link',
          actionType: 'link',
          link: '/group/${groupId}'
        },
        {
          type: 'tpl',
          visibleOn: '${!!projectName}',
          tpl: '/ ${projectName}'
        }
      ]
    },
    {
      type: 'flex',
      className: 'flex-1 justify-end gap-x-2',
      body: [
        {
          type: 'action',
          level: 'link',
          label: 'Luckdog',
          actionType: 'link',
          link: '/luckdog'
        },
        {
          type: 'select',
          name: 'searchAll',
          label: false,
          placeholder: '搜索分组/项目/接口',
          searchable: true,
          inputClassName: 'w-60'
        },
        {
          type: 'flex',
          className: 'inline-flex gap-x-2',
          body: [
            {
              type: 'link',
              icon: 'StarOutlined',
              href: '/follow',
              body: ' '
            },
            {
              type: 'link',
              icon: 'PlusCircleOutlined',
              href: '/add-project',
              body: ' '
            },
            {
              type: 'link',
              icon: 'QuestionCircleOutlined',
              href: '/docs',
              body: '文档'
            }
          ]
        },
        {
          type: 'dropdown-button',
          label: '',
          iconExpr: '${$user.avataUrl || "UserOutlined"}',
          iconClassName: 'rounded-full',
          btnClassName: 'f:border-0',
          className: 'f:hover:bg-gray-200',
          body: [
            {
              type: 'button',
              level: 'link',
              label: '个人中心',
              icon: 'UserOutlined',
              link: '/user/profile'
            },
            {
              type: 'button',
              label: '用户管理',
              level: 'link',
              icon: 'UsergroupAddOutlined'
            },
            {
              type: 'button',
              label: '系统管理',
              level: 'link',
              icon: 'SettingOutlined'
            },
            {
              type: 'button',
              label: '退出',
              level: 'link',
              icon: 'LogoutOutlined',
              onEvent: {
                click: {
                  actions: [
                    {
                      actionType: 'custom',
                      script: () => {
                        pb.authStore.clear();
                        amisEnv.jumpTo('/login');
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  ]
};
