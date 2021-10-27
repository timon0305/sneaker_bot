import rp from 'request-promise-native';
import { machineId } from 'node-machine-id';
import { app, ipcMain } from 'electron';
import settingsManager from './settings-manager';
import windowManager from '../helpers/main-window';
import logger from '../helpers/logger';
import { api_url } from '../config/setting.json';
import { metalab_key } from '../config/setting.json';

const SERVER_URL = process.env.NODE_ENV === 'development' ? 'https://google.co/' : 'https://google.io/';

async function activateKey(key): Promise<boolean> {
  // const hwid = await localStorage.getItem('hwid');
  // const hwid = await machineId();
  const options = {
    uri: `${api_url}/${key}`,
    headers: {
      Authorization: `Bearer ${metalab_key}`,
    },
    forever: true,
    json: true,
    resolveWithFullResponse: true,
  };
  try {
    const response = await rp.get(options);
    if (response.body.status === 'active') {
      settingsManager.setUserData(response.body.user);
      return true;
    }
    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function checkKey(key): Promise<boolean> {
  const hwid = await machineId();
  const options = {
    uri: `${SERVER_URL}/api/auth`,
    headers: {
      'X-MODE': Buffer.from('check').toString('base64'),
      'X-DATA': Buffer.from(key).toString('base64'),
      'X-HWID': Buffer.from(hwid).toString('base64'),
    },
    forever: true,
    json: true,
    resolveWithFullResponse: true,
  };
  return true;
}

async function deactivateKey(key): Promise<boolean> {
  // const hwid = await localStorage.getItem('hwid');
  const hwid = await machineId();
  const options = {
    uri: `${SERVER_URL}/api/auth`,
    headers: {
      'X-MODE': Buffer.from('deactivate').toString('base64'),
      'X-DATA': Buffer.from(key).toString('base64'),
      'X-HWID': Buffer.from(hwid).toString('base64'),
    },
    forever: true,
    json: true,
    resolveWithFullResponse: true,
  };
  return true;
}

async function addCheckout(checkout): Promise<void> {
  if (checkout.profile === 'Example') return;
  const monitorInput = Array.isArray(checkout.monitorInput) ? checkout.monitorInput.join(',') : checkout.monitorInput;
  if (checkout.type === 'checkout') {
    windowManager.sendCheckoutCount();
  }
  const checkoutData = {
    success: checkout.type === 'checkout',
    item: {
      price: checkout.price ? checkout.price.replace(/[^0-9.]/g, '') : null,
      name: checkout.productName,
      size: checkout.size,
      site: checkout.site,
      imageUrl: checkout.productImage,
    },
    details: {
      profile: checkout.profile,
      checkoutTime: Date.now(),
      client: {
        key: settingsManager.getKey(),
      },
      task: {
        monitorInput,
        monitorDelay: `${checkout.delays[0]}`,
        errorDelay: `${checkout.delays[2]}`,
        mode: checkout.mode,
      },
    },
  };
  //  const response = await rp(options);
  // if (!response.body.success) {
  //   console.log('Something broke', checkoutData);
  // }
}

async function getAnalytics(key): Promise<void> {
  const options = {
    uri: `${SERVER_URL}/api/checkouts`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    qs: { key },
  };

  try {
    const response = await rp(options);
    windowManager.sendAnalyticsData(response);
  } catch (err) {
    console.log(err);
  }
}

async function keySession(key): Promise<void> {
  console.log('key sesssion');
}

export default { checkKey, activateKey, deactivateKey, addCheckout, getAnalytics, keySession };
