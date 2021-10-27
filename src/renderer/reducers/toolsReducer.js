import { SET_RATES, SET_ACCOUNT_POOL, SET_ANALYTICS, HIDE_KEY, ADD_HARVESTER, DEL_HARVESTER, SET_HARVESTERS, SET_ANALYTICS_LOADED, UPDATE_HARVESTERS } from '../actions/types';

const initialState = {
  accountPools: [],
  shippingRates: [],
  analytics: [],
  harvesters: [],
  allAnalytics: [],
  analyticsLoaded: false,
  showKey: true,
};

export default function(state = initialState, action) {
  const newState = { ...state };
  let { accountPools, shippingRates, analytics, showKey } = newState;

  switch (action.type) {
    case SET_ACCOUNT_POOL:
      accountPools = action.payload;
      newState.accountPools = accountPools;
      return newState;
    case SET_ANALYTICS_LOADED:
      newState.allAnalytics = action.payload;
      newState.analyticsLoaded = true;
      return newState;
    case SET_RATES:
      shippingRates = action.payload;
      newState.shippingRates = shippingRates;
      return newState;
    case SET_ANALYTICS:
      console.log('Setting analytics...');
      analytics = action.payload;
      newState.analytics = analytics;
      console.log(newState);
      console.log('Analytics set...');
      return newState;
    case HIDE_KEY:
      console.log('HIDING KEY!');
      showKey = !showKey;
      newState.showKey = showKey;
      return newState;
    case SET_HARVESTERS:
      newState.harvesters = action.payload;
      return newState;
    case ADD_HARVESTER:
      console.log('Hello adding harvester...');
      console.log(action.payload);
      newState.harvesters.push(action.payload);
      return newState;
    case DEL_HARVESTER:
      newState.harvesters = newState.harvesters.filter((harvester) => harvester.harvesterName !== action.payload.harvesterName);
      return newState;
    case UPDATE_HARVESTERS:
      if (action.payload.proxy) {
        const validation = /\b((?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?):\d{2,5}(:\w+:\w+)?\b/;
        if (action.payload.proxy.match(validation)) {
          const preSplit = action.payload.proxy.split(':', 4);
          const proxy = {
            proxyURL: `https=${preSplit[0]}:${preSplit[1]}`,
            username: preSplit[2] ? preSplit[2] : '',
            password: preSplit[3] ? preSplit[3] : '',
          };
          newState.harvesters[action.payload.i].proxy = proxy;
        }
      }
      return newState;
    default:
      return newState;
  }
}
