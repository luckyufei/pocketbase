import PocketBase from 'pocketbase';

export const pb = new PocketBase(`https://${location.hostname}/pb`);

pb.autoCancellation(false);

export const createAuthUserScope = () => {
  const authUser = pb.authStore.model || {};
  if (authUser.avatar) {
    authUser.avatarUrl = pb.files.getUrl(authUser, authUser.avatar, {
      thumb: '100x0'
    });
  }

  return {
    __authUser: authUser,
    __authStore: {
      isAdmin: pb.authStore.isAdmin,
      isValid: pb.authStore.isValid,
      token: pb.authStore.token,
      isAuthRecord: pb.authStore.isAuthRecord
    }
  };
};
console.log(
  `pbAuth, isAdmin=${pb.authStore.isAdmin}, isValid=${pb.authStore.isValid}, isAuthRecord=${pb.authStore.isAuthRecord}`
);

// beforeSend - triggered right before sending the fetch request, allowing you to inspect/modify the request config.
pb.beforeSend = function (url, options) {
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
  }

  return { url, options };
};

// afterSend - triggered after successfully sending the fetch request, allowing you to inspect/modify the response object and its parsed data.
// pb.afterSend = (response, data) => {
//   // do something with the response state
//   // console.log('afterSend---', response, data);

//   return Object.assign(data, {
//     // extend the data...
//     // additionalField: 123
//   });
// };

(window as any).pb = pb;
