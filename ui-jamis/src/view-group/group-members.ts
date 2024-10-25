import { pb } from '../libs/pocketbase';
import { ServiceSchema } from 'jamis';
import { isObjEmpty } from '../common/utils';

export const SERVICE_GROUP_MEMBERS: ServiceSchema = {
  type: 'service',
  id: 'serviceGroupMembersId',
  api: {
    url: '',
    trackExpression: '${groupId}',
    fetcherProvider: async (ctx, api) => {
      const group = await pb.collection('groups').getOne(ctx.groupId, {
        expand: 'uid,members,owner'
      });
      console.log('🚀 ~ group ~ group:', group);
      // 组长
      const members =
        ((group.expand?.owner || []).map((owner: any) => ({
          memberType: 'owner',
          uid: owner.id,
          username: owner.username
        })) as any[]) || [];

      // 开发者
      const mapDevMembers =
        ((group.expand?.members || []).map((member: any) => ({
          memberType: 'dev',
          uid: member.id,
          username: member.username
        })) as any[]) || [];
      members.push(
        ...mapDevMembers.filter(
          (mem) => !members.some((item) => item.uid === mem.uid)
        )
      );

      return {
        code: 0,
        data: {
          group,
          members,
          originOwnerIds: (group.expand?.owner || []).map(
            (item: any) => item.id
          ),
          originMembersIds: (group.expand?.members || []).map(
            (item: any) => item.id
          )
        }
      };
    }
  },
  body: [
    {
      type: 'flex',
      className: 'justify-between bg-gray-100 p-3',
      body: [
        {
          type: 'tpl',
          tpl: '${currentGroup.name} 分组成员(${COUNT(members)})人'
        },
        {
          type: 'button',
          label: '添加成员',
          level: 'primary',
          actionType: 'dialog',
          dialog: {
            title: '添加成员',
            body: [
              {
                type: 'form',
                reload: 'serviceGroupMembersId',
                api: {
                  url: '',
                  fetcherProvider: async (ctx) => {
                    const {
                      group,
                      memberType,
                      userName,
                      originOwnerIds,
                      originMembersIds
                    } = ctx;

                    let ownerResult = [];
                    let memberResult = [];
                    if (memberType === 'dev') {
                      ownerResult = originOwnerIds.filter(
                        (id: string) => id !== userName
                      );
                      memberResult = [...originMembersIds, userName];
                    } else {
                      ownerResult = [...originOwnerIds, userName];
                      memberResult = originMembersIds.filter(
                        (id: string) => id !== userName
                      );
                    }

                    const data = {
                      owner: ownerResult,
                      members: memberResult
                    };

                    try {
                      await pb.collection('groups').update(group.id, data);
                      amisLib.toast.success('添加成功！');
                      return {
                        code: 0,
                        message: ''
                      };
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
                },
                body: [
                  {
                    type: 'select',
                    label: '用户名',
                    name: 'userName',
                    placeholder: '请输入用户名',
                    searchable: true,
                    source: {
                      url: '',
                      fetcherProvider: async (ctx) => {
                        try {
                          const records = await pb
                            .collection('users')
                            .getFullList({
                              sort: '-created'
                            });

                          const sourceUserList =
                            (Array.isArray(records) &&
                              records.map((item: any) => ({
                                ...item,
                                label: item.username,
                                value: item.id
                              }))) ||
                            [];

                          return {
                            data: {
                              rows: sourceUserList.filter(
                                (item: any) =>
                                  !ctx.members.some(
                                    (mem: any) => mem.uid === item.value
                                  )
                              )
                            }
                          };
                        } catch (error) {
                          const { data, message } = error?.response;
                          !isObjEmpty(data) &&
                            amisLib.toast.error(JSON.stringify(data));
                          isObjEmpty(data) && amisLib.toast.error(message);

                          return {
                            code: 0,
                            message: '',
                            data: {
                              rows: []
                            }
                          };
                        }
                      }
                    }
                  },
                  {
                    type: 'select',
                    label: '权限',
                    name: 'memberType',
                    value: 'dev',
                    options: [
                      {
                        label: '开发者',
                        value: 'dev'
                      },
                      {
                        label: '组长',
                        value: 'owner'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    {
      type: 'table',
      source: '${members}',
      columns: [
        {
          type: 'flex',
          body: [
            {
              type: 'avatar',
              shape: 'rounded',
              src: '${avataUrl}',
              className: 'mr-4'
            },
            {
              type: 'tpl',
              tpl: '${username}',
              className: 'w-full'
            },
            {
              type: 'select',
              name: 'memberType',
              value: '${memberType}',
              className: 'mr-2',
              options: [
                {
                  label: '组长',
                  value: 'owner'
                },
                {
                  label: '开发者',
                  value: 'dev'
                }
              ],
              onEvent: {
                change: {
                  actions: [
                    {
                      actionType: 'custom',
                      script: async (renderer, doAction, event) => {
                        const { group, value: memberType, uid } = event.data;

                        const { originOwnerIds, originMembersIds } =
                          amisScoped.getComponentById('serviceGroupMembersId')
                            .props.store.data;

                        let ownerResult = [];
                        let memberResult = [];
                        if (memberType === 'dev') {
                          ownerResult = originOwnerIds.filter(
                            (id: string) => id !== uid
                          );
                          memberResult = [...originMembersIds, uid];
                        } else {
                          ownerResult = [...originOwnerIds, uid];
                          memberResult = originMembersIds.filter(
                            (id: string) => id !== uid
                          );
                        }

                        const data = {
                          owner: ownerResult,
                          members: memberResult
                        };

                        try {
                          await pb.collection('groups').update(group.id, data);
                          amisLib.toast.success('修改成功！');
                          amisScoped
                            .getComponentById('serviceGroupMembersId')
                            .reload();
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
                  ]
                }
              }
            },
            {
              type: 'button',
              icon: 'DeleteOutlined',
              iconClassName: 'text-danger',
              confirmText: '确定要删除吗？',
              onEvent: {
                click: {
                  actions: [
                    {
                      actionType: 'ajax',
                      api: {
                        url: '',
                        fetcherProvider: async (ctx: any, event) => {
                          const {
                            group,
                            memberType,
                            uid,
                            originOwnerIds,
                            originMembersIds
                          } = ctx;

                          let ownerResult = [];
                          let memberResult = [];
                          if (memberType === 'dev') {
                            ownerResult = originOwnerIds;
                            memberResult = originMembersIds.filter(
                              (id: string) => id !== uid
                            );
                          } else {
                            ownerResult = originOwnerIds.filter(
                              (id: string) => id !== uid
                            );
                            memberResult = originMembersIds;
                          }

                          const data = {
                            owner: ownerResult,
                            members: memberResult
                          };

                          try {
                            await pb
                              .collection('groups')
                              .update(group.id, data);
                            amisLib.toast.success('删除成功！');
                            amisScoped
                              .getComponentById('serviceGroupMembersId')
                              .reload();
                            return {
                              code: 0,
                              message: ''
                            };
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
