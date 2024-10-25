import { PageSchema } from 'jamis';

export const SingleProjectPage: PageSchema = {
  type: 'page',
  data: {
    interfaceCats: []
  },
  body: [
    {
      type: 'nav',
      stacked: false,
      links: [
        {
          label: '接口管理',
          to: '/project/${projectId}/interface/api',
          icon: 'UserOutlined'
        },
        {
          label: '动态',
          to: '/project/${projectId}/activity'
        },
        {
          label: '数据管理',
          to: '/project/${projectId}/data'
        },
        {
          label: '设置',
          to: '/project/${projectId}/setting'
        },
        {
          label: 'Wiki',
          to: '/project/${projectId}/wiki'
        }
      ]
    },
    { type: 'app-router', routerId: 'projectInterfaces' },
    { type: 'app-router', routerId: 'projectActivity' },
    { type: 'app-router', routerId: 'projectData' },
    { type: 'app-router', routerId: 'projectSetting' },
    { type: 'app-router', routerId: 'projectWiki' }
  ]
};
