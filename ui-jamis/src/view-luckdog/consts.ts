/**
 * 日志类型
 */
export type LogType =
  /** 异常日志上报  */
  | 'error'
  /** 普通日志上报  */
  | 'info'
  /** 心跳上报类型 */
  | 'heartbeat'
  /** 首屏上报类型 */
  | 'firstscreen'
  /** pv上报 */
  | 'pv'
  /** 事件日志 */
  | 'event'
  /** 耗时日志上报 */
  | 'time'
  /** 自定义上报 */
  | 'custom';

export const LOG_TYPE_OPTIONS = [
  { label: '异常日志(error)', value: 'error' },
  { label: '普通日志(info)', value: 'info' },
  { label: '心跳上报(heartbeat)', value: 'heartbeat' },
  { label: '首屏上报(firstscreen)', value: 'firstscreen' },
  { label: 'PV', value: 'pv' },
  { label: '事件日志(event)', value: 'event' },
  { label: '耗时上报(time)', value: 'time' },
  { label: '自定义上报(custom)', value: 'custom' }
];

export const APPID_OPTIONS = [
  {
    label: 'JARVIS',
    value: 'jarvis'
  },
  {
    label: 'DOS',
    value: 'dos'
  },
  {
    label: 'JAM',
    value: 'jam'
  }
];

export const ENV_OPTIONS = [
  { label: 'PROD', value: 'prod' },
  { label: 'TEST', value: 'test' },
  { label: 'SIT', value: 'sit' },
  { label: 'DEV', value: 'dev' },
  { label: 'DEBUG', value: 'debug' }
];
