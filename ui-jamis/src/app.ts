import type { AppRouter, AppSchema } from 'jamis';
import { PageStatistic } from './view-admin/statistic';
import { PageGroup } from './view-group/group';
import { InterfacesPage } from './view-interface/interface';
import { InterfaceApiPage } from './view-interface/interface-api';
import { InterfaceColsPage } from './view-interface/interface-cols';
import { SingleInterfacePage } from './view-interface/interface-single';
import { PageProjectActivity } from './view-project/project-activity';
import { PageAddProject } from './view-project/project-add';
import { PageProjectData } from './view-project/project-data';
import { PageProjectSetting } from './view-project/project-setting';
import { SingleProjectPage } from './view-project/project-single';
import { PageProjectWiki } from './view-project/project-wiki';
import { PageProjects } from './view-project/projects';
import { PageLogin } from './view-user/login';
import { PageUserList } from './view-user/user-list';
import { PageUserProfile } from './view-user/user-profile';
import { PageFollow } from './views/follow';
import { SCHEMA_HEADER } from './views/header';
import { PagePersonalCenter } from './view-user/personal-center';
import { PageLuckdog } from './view-luckdog/luckdog';

const pages: AppRouter[] = [
  {
    url: '/',
    redirect: '/login'
  },
  {
    url: '/login',
    label: '登录',
    isDefaultPage: true,
    schema: PageLogin,
    visible: false,
    hooks: {
      beforeEnter: {
        checkExpression: '${__authStore.isValid}',
        failbackAction: {
          actionType: 'link',
          args: { link: '/group' }
        }
      }
    }
  },
  {
    url: '/luckdog',
    label: 'Luckdog',
    schema: PageLuckdog
  },
  {
    url: '',
  },
  {
    url: '/user',
    label: '用户',
    children: [
      {
        url: '/user/profile/:uid',
        label: '用户资料',
        schema: PageUserProfile
      },
      {
        url: '/user/list',
        label: '用户列表',
        schema: PageUserList
      },
      {
        url: '/user/profile',
        label: '个人设置',
        schema: PagePersonalCenter,
        visible: false
      },
      {
        url: '/follow',
        schema: PageFollow,
        label: '我的关注'
      }
    ]
  },
  {
    url: '/project',
    label: '项目',
    schema: PageProjects,
    hooks: {
      beforeEnter: {
        checkExpression: '${!__authStore.isValid}',
        failbackAction: {
          actionType: 'link',
          args: {
            link: '/login'
          }
        }
      }
    },
    children: [
      {
        url: '/add-project',
        label: '创建项目',
        schema: PageAddProject
      },
      {
        url: '/project/:projectId',
        label: '具体项目',
        schema: SingleProjectPage,
        redirect: 'interface/api',
        children: [
          {
            url: 'interface',
            id: 'projectInterfaces',
            label: '接口合计',
            nested: true,
            schema: InterfacesPage,
            children: [
              {
                url: 'api(/cat-)?:catId?', // 支持正则
                id: 'interfaceApis',
                label: '接口',
                schema: InterfaceApiPage,
                nested: true
              },
              {
                id: 'singleInterface',
                url: 'api/:interfaceId',
                label: '单个接口',
                nested: true,
                schema: SingleInterfacePage
              },
              {
                url: 'col',
                id: 'interfaceCols',
                schema: InterfaceColsPage,
                nested: true,
                label: '测试合集'
              }
            ]
          },
          {
            url: 'activity',
            id: 'projectActivity',
            schema: PageProjectActivity,
            label: '活动',
            nested: true
          },
          {
            url: 'data',
            id: 'projectData',
            schema: PageProjectData,
            label: '数据管理',
            nested: true
          },
          {
            url: 'setting',
            id: 'projectSetting',
            schema: PageProjectSetting,
            label: '设置',
            nested: true
          },
          {
            url: 'wiki',
            id: 'projectWiki',
            schema: PageProjectWiki,
            label: 'Wiki',
            nested: true
          }
        ]
      }
    ]
  },
  {
    url: '/group',
    schema: PageGroup,
    label: '分组',
    children: [
      {
        url: '/group/:groupId',
        schema: PageGroup,
        label: '具体分组'
      }
    ]
  },
  {
    label: '管理员',
    url: '/admin',
    children: [
      {
        url: '/statistic',
        label: '统计信息',
        schema: PageStatistic
      }
    ]
  }
];

export const APP: AppSchema = {
  type: 'app',
  id: 'cjapiAppId',
  brandName: 'CJAPI',
  brandLink: '/group',
  brandClassName: ['font-bold', 'f:pl-0 f:gap-x-4'],
  showBreadcrumb: false,
  header: SCHEMA_HEADER,
  pageStyle: {
    minHeight: 'calc(100vh - 160px)'
  },
  footerClassName: 'mt-3 f:static',
  footer: [
    {
      type: 'copyright'
    }
  ],
  aside: { visible: false },
  pages,
  onEvent: {
    routerChange: {
      actions: [
        {
          actionType: 'log'
        }
      ]
    }
  }
};
