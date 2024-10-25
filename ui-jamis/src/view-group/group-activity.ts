import { pb } from '../libs/pocketbase';
import type { ServiceSchema } from 'jamis';

export const SERVICE_GROUP_ACTIVITY: ServiceSchema = {
  type: 'service',
  id: 'groupActivityServiceId',
  data: {
    perPage: 20,
    page: 1,
    logs: [],
    totalItems: 0
  },
  api: {
    url: '',
    trackExpression: '${page}',
    fetcherProvider: async (ctx, api) => {
      const logList = await pb
        .collection('logs')
        .getList(ctx.page, ctx.perPage, {
          filter: `opGroup.id = "${ctx.groupId}" || opProject.groupId = "${ctx.groupId}"`,
          expand: 'uid',
          sort: '-updated',
          skipTotal: true
        });
      console.log('🚀 ~ logs ~ logs:', logList);
      return {
        code: 0,
        data: {
          ...logList,
          logs: ctx.logs.concat(
            logList.items.map((log) => ({
              id: log.id,
              logType: log.opGroup ? '分组动态' : '项目动态',
              user: log.expand?.uid,
              time: log.updated,
              detail: log.content
            }))
          )
        }
      };
    }
  },
  body: [
    {
      type: 'timeline',
      source: '${logs}'
    },
    {
      type: 'action',
      label: '加载更多',
      disabledOn: '${COUNT(logs) >= totalItems }',
      onEvent: {
        click: {
          actions: [
            {
              actionType: 'setValue',
              componentId: 'groupActivityServiceId',
              args: {
                value: {
                  page: '${page + 1}'
                }
              }
            }
          ]
        }
      }
    }
  ]
};
