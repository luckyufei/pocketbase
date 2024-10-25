import { CRUDSchema } from 'jamis';

export const CRUD_GROUP_PROJECTS: CRUDSchema = {
  type: 'crud',
  mode: 'cards',
  api: {
    url: 'pb',
    trackExpression: '${groupId}',
    collection: 'projects',
    action: {
      type: 'getFullList',
      options: {
        sort: '-updated',
        filter: 'groupId=${groupId}'
      }
    },
    responseData: {
      projects: '${rows}'
    }
  },
  title: '${currentGroup.group_name} 分组共有 ${COUNT(projects)} 个项目',
  wrapper: {
    collapsable: false
  },
  headerToolbar: [
    {
      type: 'action',
      label: '添加项目',
      level: 'primary'
    }
  ],
  card: {
    body: [
      {
        type: 'flex',
        className: 'f:p-0 justify-between',
        body: [
          {
            type: 'flex',
            className: 'gap-x-2',
            body: [
              {
                type: 'icon',
                icon: 'FolderOutlined'
              },
              {
                type: 'tpl',
                tpl: '${name}'
              }
            ]
          },
          {
            type: 'flex',
            className: 'gap-x-1',
            body: [
              {
                type: 'action',
                icon: 'CopyOutlined',
                actionType: 'dialog',
                className: 'f:border-0 f:bg-transparent',
                dialog: {
                  title: '复制项目',
                  body: ['TODO']
                }
              },
              {
                type: 'action',
                icon: 'StarOutlined',
                className: 'f:border-0 f:bg-transparent',
                onEvent: {
                  click: {
                    actions: [{ actionType: 'log' }]
                  }
                }
              }
            ]
          }
        ]
      },
      {
        type: 'tpl',
        tpl: '更新时间: ${updated}'
      }
    ]
  },
  itemAction: {
    type: 'action',
    actionType: 'link',
    link: '/project/${id}'
  }
};
