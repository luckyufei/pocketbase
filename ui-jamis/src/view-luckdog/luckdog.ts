import { pbluckdog } from '../libs/pb-luckdog';
import { defineSchema } from '../amis/schema';
import { APPID_OPTIONS, ENV_OPTIONS, LOG_TYPE_OPTIONS } from './consts';

export const PageLuckdog = defineSchema({
  type: 'page',
  title: 'Luckdog链路日志',
  body: [
    {
      type: 'crud',
      perPage: 50,
      columnsTogglable: true,
      headerToolbar: ['columns-toggler'],
      filter: {
        title: '过滤条件',
        submitOnChange: true,
        actions: [],
        wrapWithPanel: false,
        body: [
          {
            type: 'input-datetime-range',
            name: 'created',
            value: '-30days'
          },
          {
            type: 'select',
            label: false,
            name: 'env',
            placeholder: '环境',
            options: ENV_OPTIONS
          },
          {
            type: 'select',
            name: 'logtype',
            placeholder: '日志类型',
            options: LOG_TYPE_OPTIONS
          },
          {
            type: 'select',
            label: false,
            name: 'appid',
            options: APPID_OPTIONS,
            placeholder: '应用ID'
          },
          {
            type: 'input-text',
            label: false,
            name: 'guid',
            placeholder: 'GUID',
            emitChangeDelay: 300
          },
          {
            type: 'input-text',
            label: false,
            name: 'filter',
            changeImmediately: false,
            placeholder: 'Filter',
            inputClassName: 'min-w-64',
            emitChangeDelay: 500
          }
        ]
      },
      api: {
        url: 'pb',
        silent: true,
        collection: 'luckdog_logs',
        pocketbase: pbluckdog,
        action: {
          type: 'getList',
          page: '${page}',
          perPage: '${perPage}',
          options: {
            filter: [
              'env=${env}',
              'appid=${appid}',
              'guid=${guid}',
              '${filter}',
              'created >= ${DATESTRISO(SPLIT(created, ",")[0])} && created <= ${DATESTRISO(SPLIT(created, ",")[1])}'
            ],
            sort: 'created',
          }
        },
        onEvent: {
          fetchFailed: {
            actionType: 'log'
          }
        }
      },
      columns: [
        {
          label: 'created',
          name: 'created'
        },
        {
          label: 'logtype',
          name: 'logtype',
          type: 'tag',
          bodyClassName: 'bg-green-300'
        },
        {
          label: 'env',
          name: 'env',
          type: 'tag',
          bodyClassName: 'bg-blue-500'
        },
        {
          label: 'appid',
          name: 'appid',
          type: 'tag',
          bodyClassName: 'bg-blue-300'
        },
        {
          label: 'guid',
          name: 'guid',
          type: 'tag',
          bodyClassName: 'bg-blue-200'
        },
        {
          label: 'url',
          name: 'url',
          type: 'link',
          width: 240,
          className: '!!truncate'
        },
        {
          name: 'key1',
          label: 'key1'
        },
        {
          name: 'msg',
          label: 'msg',
          width: '20%',
          className: '!!truncate'
        },
        {
          name: 'keylinks',
          label: 'keylinks',
          type: 'tpl',
          tpl: '${JOIN(SPLIT(keylinks, "=>"), "=><br/>")}',
          className: '!!truncate',
          bodyClassName: 'flex max-h-40 overflow-y-auto',
          width: '40%'
        },
        {
          name: 'lucktraceid',
          label: 'lucktraceid',
          collapsed: true
        }
      ]
    }
  ]
});
