import type { PageSchema } from 'jamis';
import { PageRegister } from './register';

export const PageLogin: PageSchema = {
  type: 'page',
  style: {
    minHeight: 'calc(100vh - 76px)'
  },
  bodyClassName: 'flex flex-col justify-center h-4/5 items-center',
  body: [
    {
      type: 'tpl',
      tpl: 'CJAPI',
      className: 'text-7xl italic text-gray-600 font-mono mb-6'
    },
    {
      type: 'tabs',
      className: 'w-128 f:h-fit\t',
      tabs: [
        {
          title: '登录',
          tab: [
            {
              type: 'form',
              title: '用户登录',
              api: {
                url: 'pb',
                collection: 'users',
                action: {
                  type: 'authWithPassword',
                  username: '${username}',
                  password: '${password}'
                },
                messages: {
                  success: '登录成功, 即将跳转...',
                  failed: '登录失败, 请输入正确的账号和密码'
                },
                onEvent: {
                  fetchSuccess: [
                    {
                      actionType: 'link',
                      execDelay: 500,
                      args: {
                        link: '/group'
                      }
                    }
                  ]
                }
              },
              body: [
                {
                  type: 'input-text',
                  label: '用户名',
                  name: 'username',
                  required: true
                },
                {
                  type: 'input-password',
                  name: 'password',
                  required: true,
                  label: '密码'
                }
              ],
              submitText: '登录'
            }
          ]
        },
        {
          title: '注册',
          tab: PageRegister
        }
      ]
    }
  ]
};
