import { pb } from '../libs/pocketbase';
import { FormSchema } from 'jamis';

export const FORM_GROUP_SETTING: FormSchema = {
  type: 'form',
  title: '',
  api: {
    url: '',
    fetcherProvider: async (ctx) => {
      const record = await pb
        .collection('groups')
        .update(ctx.form.id, ctx.form);
      return {
        code: 0,
        message: '分组保存成功!',
        data: {
          form: record
        }
      };
    }
  },
  data: {
    form: '${currentGroup}'
  },
  body: [
    {
      type: 'input-text',
      label: '分组名',
      name: 'form.group_name'
    },
    {
      type: 'textarea',
      name: 'form.group_desc'
    }
  ],
  actions: [
    {
      type: 'submit',
      label: '保存'
    },
    {
      type: 'dropdown-button',
      label: '危险操作',
      level: 'danger',
      body: [
        {
          type: 'button',
          level: 'danger',
          label: '删除',
          confirmText: '确认要删除当前分组吗? 删除操作不可恢复.'
        }
      ]
    }
  ]
};
