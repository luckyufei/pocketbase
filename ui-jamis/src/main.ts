import { createAuthUserScope, pb } from "./libs/pocketbase";
import { fetcher } from "./amis/fetcher-adaptor";
import { APP } from "./app";

window.onerror = (
  event: Event | string,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
) => {
  console.error(`Uncaught error, `, event, source, lineno, colno, error);
};

const initAmisScoped = async () => {
  const sdk = await amisLib.loadSdk();
  const rootScoped = await sdk.embed(
    "#app",
    APP,
    {
      data: {
        ...createAuthUserScope(),
      },
    },
    {
      enableAMISDebug: true,
      spa: true,
      fetcher,
      pocketbase: pb,
    }
  );

  console.log("root data scope: ", rootRenderer.props.store.moreData);

  return rootScoped;
};

initAmisScoped().then((rootScoped) => {
  // triggered once right after registration and everytime on store change
  pb.authStore.onChange((token, model) => {
    amisScoped.updateDataScope("cjapiAppId", createAuthUserScope());
  }, true);
});
