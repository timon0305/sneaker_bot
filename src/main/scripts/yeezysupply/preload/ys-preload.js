const get = require('lodash/get');
const omit = require('lodash/omit');
const { smoothScrollTo, fillCharInput, fillInput, generatePluginArray, getButtonCoords, getChromeRuntime, getRandomWindowDimensions, simulateClick, sleep } = require('./preload_utils');
const ipc = require('electron').ipcRenderer;
const { TASK_STATUSES } = require('../constants');

// Global variables
let status = TASK_STATUSES.WAITING;
let profileData;
let productId;
let instanceId;
let isProxySwitched = true;

const DEFAULT_DELAY = 350; // Milleseconds
const INPUT_TO_PROFILE_MAP = {
  firstName: 'firstname',
  lastName: 'lastname',
  address1: 'shipping.address',
  address2: 'shipping.address2',
  city: 'shipping.city',
  zipcode: 'shipping.zip',
  province: 'shipping.stateName',
  phoneNumber: 'phone',
  emailAddress: 'email',
  'card-number': 'cardnumber',
  name: 'cardholdername',
  expiry: 'expdate',
  'security-number-field': 'cvv',
};

function setRandomWindowDimensions() {
  const windowDimensions = getRandomWindowDimensions();
  window.innerHeight = windowDimensions.height;
  window.innerWidth = windowDimensions.width;
  window.outerWidth = windowDimensions.width;
}

ipc.on('setInitValues', (event, profile, taskId, product) => {
  profileData = profile;
  sessionStorage.setItem('profileData', profileData);
  productId = product;
  sessionStorage.setItem('productId', productId);
  instanceId = taskId;
  sessionStorage.setItem('instanceId', instanceId);
  ipc.send('updateStatus', instanceId, status);
});

window.addEventListener('DOMContentLoaded', async () => {
  window.chrome = getChromeRuntime();
  Object.defineProperty(navigator, 'plugins', {
    get: () => generatePluginArray(),
  });
  /*window.onbeforeunload = function () {
    return '';
  };*/
  checkWaitingRoomStatus();
});

async function checkWaitingRoomStatus() {
  while (document.querySelectorAll("[data-auto-id='ys-add-to-bag-btn']").length === 0) {
    await sleep(1000);
  }
  if (window.bmak) {
    const oldcma = window.bmak.cma;
    window.bmak.cma = function(a, t) {
      const clone = omit(a, ['isTrusted']);
      clone.isTrusted = true;
      oldcma(clone, t);
    };
  }
  setRandomWindowDimensions();
  status = TASK_STATUSES.PASSED_QUEUE;
  ipc.send('switchToProxy', instanceId);
  ipc.send('updateStatus', instanceId, status);

  while (!isProxySwitched) {
    await sleep(200);
  }

  while (document.getElementsByClassName('gl-dropdown-native__select-element').length === 0) {
    await sleep(DEFAULT_DELAY);
  }
  simulateClick(document.elementFromPoint(11, 30));
  await sleep(200);
  const sizeSelector = document.getElementsByClassName('gl-dropdown-native__select-element')[0];
  const availableSizes = Array.prototype.slice
    .call(sizeSelector.children)
    .map((el) => el.innerText)
    .filter((size) => size.length > 0);
  sizeSelector.focus();
  simulateClick(sizeSelector);
  instanceId = instanceId || sessionStorage.getItem('instanceId');
  ipc.send('ysSendSizeInput', instanceId, availableSizes);
}

async function autofillShippingInfo() {
  while (!window.location.href.includes('delivery')) {
    await sleep(DEFAULT_DELAY);
  }
  status = TASK_STATUSES.ENTERING_SHIPPING;
  ipc.send('updateStatus', instanceId, status);
  while (document.getElementsByClassName('gl-input__field').length < 8) {
    await sleep(DEFAULT_DELAY);
  }
  const inputs = document.getElementsByClassName('gl-input__field');
  autofillInputs(inputs, true);
}

async function autofillYSCardInfo() {
  while (!window.location.href.includes('payment')) {
    await sleep(DEFAULT_DELAY);
  }
  status = TASK_STATUSES.ENTERING_PAYMENT;
  ipc.send('updateStatus', instanceId, status);
  while (document.getElementsByClassName('gl-input__field').length < 4) {
    await sleep(DEFAULT_DELAY);
  }
  const inputs = document.getElementsByClassName('gl-input__field');
  autofillInputs(inputs);
  submitForm('place-order-button');
}

async function autofillProvince() {
  while (document.getElementsByClassName('gl-dropdown-native__select-element').length === 0) {
    await sleep(DEFAULT_DELAY);
  }
  let provinceSelector = document.getElementsByClassName('gl-dropdown-native__select-element')[0];
  provinceSelector.focus();
  simulateClick(provinceSelector);
  instanceId = instanceId || sessionStorage.getItem('instanceId');
  // TODO: remove ipc dependency
  ipc.send('sendStateInput', instanceId, INPUT_TO_PROFILE_MAP.province);
}

async function autofillInputs(inputs, fillProvince) {
  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
    const input = inputs[inputIndex];
    simulateClick(input);
    const fieldName = input.getAttribute('name') || input.getAttribute('id');
    const inputVal = get(profileData, INPUT_TO_PROFILE_MAP[fieldName]);
    fillInput(input, inputVal);
    await sleep(50);
  }
  if (fillProvince) {
    autofillProvince();
  }
}

async function submitForm(buttonName) {
  while (document.querySelectorAll(`[data-auto-id=${buttonName}]`).length === 0) {
    await sleep(DEFAULT_DELAY);
  }
  const submitButton = document.querySelectorAll(`[data-auto-id=${buttonName}]`)[0].children[0];
  const coords = getButtonCoords(submitButton);
  if (window.location.href.includes('delivery')) {
    while (document.querySelectorAll('[data-auto-id="delivery-option-name"]').length === 0) {
      await sleep(DEFAULT_DELAY);
    }
    status = TASK_STATUSES.SUBMIT_SHIPPING;
    autofillYSCardInfo();
    simulateClick(document.elementFromPoint(11, 30));
    await sleep(3500);
    smoothScrollTo(coords.y, 500);
    await sleep(1000);
  } else {
    status = TASK_STATUSES.SUBMIT_PAYMENT;
    await sleep(2500);
  }
  simulateClick(document.elementFromPoint(11, 30));
  await sleep(100);
  ipc.send('updateStatus', instanceId, status);
  simulateClick(submitButton);
}

ipc.on('ysAddToCart', async (event, success) => {
  simulateClick(document.elementFromPoint(11, 30));
  await sleep(500);
  if (success === true) {
    const purchaseButton = document.querySelectorAll('[data-auto-id="ys-add-to-bag-btn"]')[0].children[0];
    simulateClick(purchaseButton);
    while (document.querySelectorAll('[data-auto-id="yeezy-mini-basket"]')[0].innerText === '') {
      await sleep(DEFAULT_DELAY);
    }
    document.querySelectorAll('[data-auto-id="minicart-checkout-button"]')[0].click();
  }
  autofillShippingInfo();
});

ipc.on('submitForm', async () => {
  submitForm('review-and-pay-button');
});

ipc.on('proxySwitched', async () => {
  isProxySwitched = true;
  simulateClick(document.querySelectorAll('[data-auto-id="ys-product-name"]')[0]);
  await sleep(200);
});
