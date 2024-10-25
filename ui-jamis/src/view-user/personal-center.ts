import type { PageSchema } from 'jamis';
import { pb } from '../libs/pocketbase';
import avatar from '../assets/avatar.png';
import { isObjEmpty } from '../common/utils';

export const PagePersonalCenter: PageSchema = {
  type: 'page',
  bodyClassName: 'flex justify-center',
  style: {
    backgroundColor: '#eceef1',
    minHeight: 'calc(100vh - 160px)'
  },
  body: [
    {
      type: 'form',
      title: false,
      className: 'max-w-7xl bg-white p-16 mt-4',
      wrapWithPanel: false,
      body: [
        {
          type: 'tpl',
          className: 'text-2xl',
          tpl: '个人设置'
        },
        {
          type: 'property',
          column: 1,
          contentClassName: 'pl-10 pb-4',
          items: [
            {
              label: false,
              content: {
                type: 'tooltip-wrapper',
                content:
                  '点击头像更换 (只支持jpg、png格式且大小不超过200kb的图片)',
                className: 'flex-grow-0',
                placement: 'right',
                body: [
                  {
                    type: 'image',
                    thumbClassName: 'h-24 w-24',
                    bodyClassName: 'border-0',
                    imageClassName: 'rounded-full shadow-md',
                    defaultImage: avatar,
                    src: '${$user.avataUrl}',
                    clickAction: {
                      actionType: 'ajax',
                      api: {
                        url: '',
                        fetcherProvider: (ctx: any) => {
                          const { id } = ctx.$user;

                          // 创建 input 标签
                          const imageInput = document.createElement('input');
                          imageInput.type = 'file';
                          imageInput.id = 'fileInput';
                          imageInput.name = 'file';
                          imageInput.accept =
                            'image/jpeg, image/png, image/jpg';
                          imageInput.style.display = 'none';
                          document.body.appendChild(imageInput);

                          // 触发文件上传
                          imageInput.click();
                          imageInput.onchange = async (event: any) => {
                            if (event.target.files.length > 0) {
                              const formData = new FormData();
                              formData.append('avatar', event.target.files[0]);

                              try {
                                await pb
                                  .collection('users')
                                  .update(id, formData);
                                amisLib.toast.success('更新头像成功！');
                              } catch (error) {
                                const { code, data, message } = error?.response;
                                if (code === 400) {
                                  !isObjEmpty(data) &&
                                    amisLib.toast.error(JSON.stringify(data));
                                  isObjEmpty(data) &&
                                    amisLib.toast.error(message);

                                  return {
                                    code: 0,
                                    message: ''
                                  };
                                }
                              }
                            }
                          };
                        },
                        adaptor: (payload: JSObject) => ({
                          ...payload,
                          msg: '选择你要更新的头像'
                        })
                      }
                    }
                  }
                ]
              }
            },
            {
              label: '用户名',
              content: {
                type: 'static',
                name: '${$user.username}',
                quickEdit: {
                  type: 'form',
                  data: {
                    newUserName: '${$user.username}'
                  },
                  body: [
                    {
                      type: 'input-text',
                      name: 'newUserName',
                      clearable: true,
                      required: true,
                      validations: {
                        minLength: 3,
                        maxLength: 150
                      },
                      placeholder: '用户名'
                    }
                  ],
                  onSubmit: async (ctx: JSObject) => {
                    const { newUserName } = ctx;
                    const { id } = ctx.$user;
                    try {
                      await pb.collection('users').update(id, {
                        username: newUserName
                      });
                      amisLib.toast.success('修改用户名成功！');
                    } catch (error) {
                      const { code, data, message } = error?.response;
                      if (code === 400) {
                        !isObjEmpty(data) &&
                          amisLib.toast.error(JSON.stringify(data));
                        isObjEmpty(data) && amisLib.toast.error(message);

                        return {
                          code: 0,
                          message: ''
                        };
                      }
                    }
                  }
                }
              }
            },
            {
              label: '邮箱',
              content: {
                type: 'static',
                name: '${$user.email}',
                quickEdit: {
                  type: 'form',
                  data: {
                    newEmail: '${$user.email}'
                  },
                  body: [
                    {
                      type: 'input-email',
                      name: 'newEmail',
                      clearable: true,
                      required: true,
                      placeholder: '邮箱'
                    }
                  ],
                  onSubmit: async (ctx: JSObject) => {
                    const { newEmail } = ctx;
                    const { id } = ctx.$user;
                    try {
                      await pb.collection('users').update(id, {
                        email: newEmail
                      });
                      amisLib.toast.success('修改邮箱成功！');
                    } catch (error) {
                      const { code, data, message } = error?.response;
                      if (code === 400) {
                        !isObjEmpty(data) &&
                          amisLib.toast.error(JSON.stringify(data));
                        isObjEmpty(data) && amisLib.toast.error(message);

                        return {
                          code: 0,
                          message: ''
                        };
                      }
                    }
                  }
                }
              }
            },
            {
              label: '创建账号时间',
              content: {
                type: 'tpl',
                tpl: '${DATETOSTR($user.created, "YYYY-MM-DD HH:mm:ss")}'
              }
            },
            {
              label: '更新账号时间',
              content: {
                type: 'tpl',
                tpl: '${DATETOSTR($user.updated, "YYYY-MM-DD HH:mm:ss")}'
              }
            },
            {
              label: '密码',
              content: {
                type: 'static-tpl',
                tpl: '******',
                quickEdit: {
                  type: 'form',
                  rules: [
                    {
                      rule: 'data.password === data.passwordConfirm',
                      message: '两次输入的密码不一致'
                    }
                  ],
                  body: [
                    {
                      type: 'input-password',
                      name: 'oldPassword',
                      clearable: true,
                      required: true,
                      placeholder: '旧密码'
                    },
                    {
                      type: 'input-password',
                      name: 'password',
                      clearable: true,
                      required: true,
                      placeholder: '新密码',
                      validations: {
                        minLength: 6,
                        maxLength: 72
                      }
                    },
                    {
                      type: 'input-password',
                      name: 'passwordConfirm',
                      clearable: true,
                      required: true,
                      placeholder: '确认密码'
                    }
                  ],
                  onSubmit: async (ctx: JSObject) => {
                    const { oldPassword, password, passwordConfirm } = ctx;
                    const { id } = ctx.$user;
                    try {
                      await pb.collection('users').update(id, {
                        password,
                        passwordConfirm,
                        oldPassword
                      });
                      amisLib.toast.success('修改密码成功！');
                    } catch (error) {
                      const { code, data, message } = error?.response;
                      if (code === 400) {
                        !isObjEmpty(data) &&
                          amisLib.toast.error(JSON.stringify(data));
                        isObjEmpty(data) && amisLib.toast.error(message);

                        return {
                          code: 0,
                          message: ''
                        };
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  ]
};
