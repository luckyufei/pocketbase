import type { PageSchema } from 'jamis';
import { pb } from '../libs/pocketbase';
import { isObjEmpty } from '../common/utils';

export const PageRegister: PageSchema = {
  type: 'page',
  body: [
    {
      type: 'form',
      title: '用户注册',
      api: {
        url: '',
        fetcherProvider: async (ctx) => {
          const { username, email, password, passwordConfirm } = ctx;

          try {
            await pb.collection('users').create({
              username,
              email,
              emailVisibility: true,
              password,
              passwordConfirm,
              passsalt: 'test',
              study: true,
              role: 'member',
              type: 'site',
              nickName: username
            });

            return {
              code: 0,
              message: '注册成功！'
            };
          } catch (error: any) {
            const { code, data, message } = error?.response;
            if (code === 400) {
              !isObjEmpty(data) && amisLib.toast.error(JSON.stringify(data));
              isObjEmpty(data) && amisLib.toast.error(message);

              return {
                code: 0,
                message: ''
              };
            }
          }
        }
      },
      rules: [
        {
          rule: 'data.password === data.passwordConfirm',
          message: '两次输入的密码不一致'
        }
      ],
      body: [
        {
          type: 'input-text',
          label: '用户名',
          name: 'username',
          required: true,
          validations: {
            minLength: 3,
            maxLength: 150
          }
        },
        {
          type: 'input-email',
          name: 'email',
          required: true,
          label: '邮箱'
        },
        {
          type: 'input-password',
          name: 'password',
          required: true,
          label: '密码',
          validations: {
            minLength: 6,
            maxLength: 72
          }
        },
        {
          type: 'input-password',
          name: 'passwordConfirm',
          required: true,
          label: '确认密码'
        }
      ],
      submitText: '注册'
    }
  ]
};
