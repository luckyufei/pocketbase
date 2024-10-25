import { NavSchema } from 'jamis';

export const NAV_PROJECTS: NavSchema = {
  type: 'nav',
  stacked: false,
  links: [
    {
      label: '接口管理',
      to: './interfaces',
      icon: 'UserOutlined'
    },
    {
      label: '动态',
      to: './activity'
    },
    {
      label: '数据管理',
      to: './data'
    },
    {
      label: '设置',
      to: './setting'
    },
    {
      label: 'Wiki',
      to: './wiki'
    }
  ]
};
