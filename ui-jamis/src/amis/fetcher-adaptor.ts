import type {RendererEnv} from 'jamis';

let hasJumpLogin = false;

const axios = amisRequire('axios');
const formatUrl = (uri: string) => uri;
// const formatUrl = (uri: string) => `${uri}`;

// 可以不传，全局 api 请求适配器
// 另外在 amis 配置项中的 api 也可以配置适配器，针对某个特定接口单独处理。
export const requestAdaptor = (api: JSObject): JSObject => {
  api.url = formatUrl(api.url);
  return api;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const makeResponseAdaptor = (api: JSObject, response: JSObject): JSObject => {
  console.log('🚀 ~ makeResponseAdaptor ~ response:', response);
  // console.log('[responseAdaptor] response: ', response, ', api: ', api, ', request=', _request);
  if (response.status !== undefined) {
    return response;
  }
  // yapi返回了错误码
  if (response.errcode !== undefined) {
    const {errcode, errmsg, data} = response;
    return {
      status: errcode === 0 ? 0 : errcode,
      resMsg: errmsg,
      data,
    };
  }
  if (response.code === undefined) {
    const {records, rows, items, data, message, recordsTotal} = response;
    const res = {
      status: 0,
      data: {},
    } as any;
    if (typeof data === 'object') res.data = data;
    else if (Array.isArray(rows)) res.data.rows = rows;
    else if (Array.isArray(items)) res.data.items = items;
    else res.data = typeof response === 'object' ? response : {response};

    if (typeof message === 'string') res.data.message = message;
    if (typeof records === 'number') res.data.count = records;
    if (typeof recordsTotal === 'number') res.data.count = records;

    return res;
  }
  const {code, msg, data, paging, message} = response || {
    code: -1,
    msg: 'Ajax Error',
    data: [],
    paging: {},
  };
  return {
    status: code === 200 ? 0 : code,
    resMsg: msg || message,
    data: {
      rows: data ?? [],
      count: paging?.total || 0,
      paging,
      message,
    },
  };
};

// 可以不传，全局 api 适配器。
// 另外在 amis 配置项中的 api 也可以配置适配器，针对某个特定接口单独处理。
export const responseAdaptor = (api: JSObject, response: JSObject): JSObject => {
  const finalRes = makeResponseAdaptor(api, response);
  console.log(`[responseAdaptor] api=${api.url}, finalRes=`, finalRes);
  return finalRes;
};

const configAdaptor = (api: any): JSObject => {
  const {url, method, responseType, headers} = api;
  let {data, config = {}} = api;

  config.url = url;
  config.withCredentials = true;
  responseType && (config.responseType = responseType);

  if (config.cancelExecutor) {
    config.cancelToken = new (axios as any).CancelToken(config.cancelExecutor);
  }

  config.headers = headers || {};
  config.method = method;
  config.data = data;

  config = requestAdaptor(config);

  if (method === 'get' && data) {
    config.params = data;
  } else if (data && data instanceof FormData) {
    // config.headers['Content-Type'] = 'multipart/form-data';
  } else if (data && typeof data !== 'string' && !(data instanceof Blob) && !(data instanceof ArrayBuffer)) {
    data = JSON.stringify(data);
    config.headers['Content-Type'] = 'application/json';
  }

  // 支持返回各种报错信息
  config.validateStatus = () => true;
  return config;
};

export const fetcher: RendererEnv['fetcher'] = async (api: any) => {
  const {url, query, fetcherProvider} = api;
  let {config} = api;

  // 通过provider拦截部分请求
  if (fetcherProvider) {
    const resData = await fetcherProvider(query, config);
    return {
      status: 0,
      ok: true,
      data: resData || {},
    };
  }
  config = configAdaptor(api);

  const s = Date.now();
  let response = await axios(config);

  response = await amisLib.attachmentAdpator(response);

  if (response.status === 200) {
    return {
      ok: true,
      status: 0,
      data: responseAdaptor(api, response.data || {}),
    };
  }

  if (response.status >= 400) {
    // 401要转换成status为0, 不然有默认行为
    if (response.status === 401) {
      // 避免因多个接口401触发多次提醒
      if (hasJumpLogin) {
        return {
          status: 0,
          ok: true,
          data: {
            status: 500,
            msg: '',
            data: {
              rows: [],
            },
          },
        };
      }
      setTimeout(() => {
        hasJumpLogin = false;
        window.alert('用户需要登录');
      }, 3000);
      hasJumpLogin = true;

      amisLib.toast.info(__('jam.login.refresh'));
    } else if (response.status === 403) {
      throw new Error(__('jam.permission.no'));
    } else {
      window.alert(`接口请求失败: 状态码=${response.status},  响应内容是=${response.data}`);
    }

    return {
      status: response.status,
      data: {
        // 需要嵌套一层
        // 错误状态码统一返回 500, 由调用接口处统一静默处理，避免弹窗与toast同时出现
        status: 500,
        msg: response.data?.msg || response.data?.message || '',
        data: {
          resStatus: response.status,
          resData: response.data,
          rows: [],
        },
      },
    };
  }

  return response;
};
