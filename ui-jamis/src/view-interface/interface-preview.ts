import { SchemaObject } from 'jamis';
import { pb } from '../libs/pocketbase';
import { parseResBody } from './parse-res-body';

/**
 * 接口预览界面
 */
export const InterfacePreviewView: SchemaObject = {
  type: 'service',
  // debug: true,
  api: {
    url: '',
    trackExpression: '${interfaceId}',
    fetcherProvider: async (ctx) => {
      const record = await pb.collection('interfaces').getOne(ctx.interfaceId, {
        expand: 'uid'
      });
      console.log(
        '🚀 ~ fetcherProvider: ~ record:',
        record,
        ', for interfaceId: ',
        ctx.interfaceId
      );

      return {
        data: {
          ...record,
          resBody: parseResBody(record.resBody),
          originResBody: JSON.parse(record.resBody)
        }
      };
    }
  },
  onEvent: {
    fetchInited: {
      actions: [
        { actionType: 'log' },
        {
          actionType: 'deferLoad',
          componentId: 'interfaceCatsNav',
          args: {
            linkId: '${event.data.catId}'
          }
        }
      ]
    }
  },
  body: [
    {
      type: 'wrapper',
      title: '基本信息',
      bordered: false,
      size: 'none',
      bodyClassName: 'p-3',
      body: [
        {
          type: 'property',
          column: 2,
          items: [
            {
              label: '接口名称',
              content: '${title}'
            },
            { label: '创建人', content: '${expand.uid.username}' },
            {
              label: '状态',
              content: {
                type: 'mapping',
                name: 'status',
                map: {
                  undone: '<span class="label label-danger">未完成<span>',
                  done: '<span class="label label-success">未完成<span>'
                }
              }
            },
            {
              label: '更新时间',
              content: '${updated}'
            },
            {
              label: '标签',
              content: {
                type: 'each',
                name: 'tag',
                items: { type: 'tag', tag: '${item}' }
              }
            },
            {
              label: '接口路径',
              content:
                '<span class="p-0.5 bg-green-200 text-green-400">${method}</span> <span>${path}</span>'
            },
            {
              label: 'Mock地址',
              content: {
                type: 'link',
                href: 'https://cjapi.woa.com/mock/${projectId}${path}',
                body: 'https://cjapi.woa.com/mock/${projectId}${path}'
              }
            }
          ]
        }
      ]
    },
    {
      type: 'wrapper',
      title: '请求参数: Query',
      bodyClassName: 'p-3',
      bordered: false,
      body: {
        type: 'table',
        source: '${reqQuery}',
        columns: [
          {
            label: '参数名称',
            name: 'name'
          },
          {
            label: '是否必须',
            name: 'required',
            type: 'tpl',
            tpl: '${required === "1" ? "是" : "否" }'
          },
          {
            label: '示例',
            name: 'demo'
          },
          {
            label: '备注',
            name: 'desc'
          }
        ]
      }
    },
    {
      type: 'wrapper',
      title: '请求参数: Headers',
      bordered: false,
      visibleOn: '${!!LENGTH(reqHeaders)}',
      bodyClassName: 'p-3',
      body: {
        type: 'table',
        source: '${reqHeaders}',
        columns: [
          {
            label: '参数名称',
            name: 'name'
          },
          {
            label: '是否必须',
            name: 'required',
            type: 'tpl',
            tpl: '${required === "1" ? "是" : "否" }'
          },
          {
            label: '示例',
            name: 'demo'
          },
          {
            label: '备注',
            name: 'desc'
          }
        ]
      }
    },
    {
      type: 'wrapper',
      title: '返回数据',
      bodyClassName: 'p-3',
      bordered: false,
      body: {
        type: 'table',
        source: '${resBody}',
        striped: true,
        columns: [
          {
            label: '名称',
            name: 'name'
          },
          {
            label: '类型',
            name: 'type'
          },
          {
            label: '是否必须',
            name: 'required',
            width: 100
          },
          {
            label: '默认值',
            name: 'default',
            width: 80
          },
          {
            label: '备注',
            name: 'description'
          },
          {
            label: '其他',
            name: 'other'
          }
        ]
      }
    }
  ]
};
