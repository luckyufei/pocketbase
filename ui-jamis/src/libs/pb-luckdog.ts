import PocketBase, { LocalAuthStore } from 'pocketbase';
import { pb } from './pocketbase';

export const pbluckdog = new PocketBase(
  `https://${location.hostname}/pbluckdog`,
  new LocalAuthStore('luckdog_auth')
);

(async () => {
  pbluckdog.autoCancellation(false);
  // beforeSend - triggered right before sending the fetch request, allowing you to inspect/modify the request config.
  pbluckdog.beforeSend = async (url, options) => {
    // For list of the possible request options properties check
    // https://developer.mozilla.org/en-US/docs/Web/API/fetch#options
    options.headers = Object.assign({}, options.headers, {
      // 'X-Custom-Header': 'example',
    });

    if (
      !pb.authStore.isValid &&
      !['/login', '/register'].includes(location.pathname)
    ) {
      amisLib.toast.error('登录状态已过期，即将刷新......');
      setTimeout(() => amisEnv.jumpTo('/login'), 1000);
      return;
    }

    return { url, options };
  };

  if (!pbluckdog.authStore.isValid) {
    const result = await pbluckdog
      .collection('users')
      .authWithPassword('luckdog@tencent.com', 'jarvis@123');
    console.log('🚀 ~ pbluckdog login result: ', result);
  }
})();
