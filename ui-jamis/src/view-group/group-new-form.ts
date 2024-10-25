import { FormSchema } from 'jamis';
import { pb } from '../libs/pocketbase';

export const GroupNewForm: FormSchema = {
  type: 'form',
  api: {
    url: '',
    fetcherProvider: async (ctx, api) => {
      const { groupName, groupDesc, groupOwner, $user } = api.data as JSObject;

      try {
        const data = {
          name: groupName,
          desc: groupDesc,
          type: 'public',
          uid: $user.id,
          customField1: {
            enabled: false
          },
          owner: [...new Set((groupOwner.split(',') || []).concat($user.id))]
        };

        await pb.collection('groups').create(data);
        return {
          code: 0,
          message: '添加分组成功！'
        };
      } catch (error: any) {
        const { code, data, message } = error?.response ?? {};
        if (code === 400) {
          Object.keys(data).length && amisLib.toast.error(JSON.stringify(data));
          Object.keys(data).length && amisLib.toast.error(message);

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
      type: 'input-text',
      label: '分组名',
      name: 'groupName',
      placeholder: '请输入分组名称',
      required: true
    },
    {
      type: 'textarea',
      label: '简介',
      name: 'groupDesc',
      placeholder: '请输入分组描述'
    },
    {
      type: 'select',
      label: '组长',
      name: 'groupOwner',
      placeholder: '请输入用户名',
      searchable: true,
      multiple: true,
      source: {
        url: '',
        fetcherProvider: async () => {
          try {
            const records = await pb.collection('users').getFullList({
              sort: '-created'
            });

            return {
              data: {
                rows:
                  (Array.isArray(records) &&
                    records.map((item: any) => ({
                      ...item,
                      label: item.username,
                      value: item.id
                    }))) ||
                  []
              }
            };
          } catch (error: any) {
            const { data, message } = error?.response;
            Object.keys(data).length &&
              amisLib.toast.error(JSON.stringify(data));
            Object.keys(data).length && amisLib.toast.error(message);

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
    }
  ]
};
