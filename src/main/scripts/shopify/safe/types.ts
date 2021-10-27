export interface Checkpoints {
  LOADED_HOMEPAGE: boolean;
  LOGGED_IN: boolean;
  CREATED_CHECKOUT: boolean; // Used to check if checkpoint is necessary
  ADD_TO_CART: boolean;
  SOLVED_CHECKPOINT: boolean;
  PROCEEDED_TO_CHECKOUT: boolean;
  SUBMITTED_CUSTOMER_INFO: boolean;
  GOT_SHIPPING_RATE: boolean;
  SUBMITTED_SHIPPING_RATE: boolean;
  GOT_PAYMENT_PAGE: boolean;
  SUBMITTED_PAYMENT: boolean;
}

export interface ShopifyProduct {
  size?: string;
  variant?: string | string[] | number;
  special?: { dsmHash?: string; cartForm?: any };
  price?: string;
  image?: string;
  name?: string;
}

export interface TaskState {
  restock: {
    active: boolean;
    restockUrl: string;
  };
  queue: {
    active: boolean;
    ctd: string;
  };
  checkpoint: {
    active: boolean;
  };
}

export interface BrowserData {
  'checkout[client_details][browser_width]': number;
  'checkout[client_details][browser_height]': number;
  'checkout[client_details][javascript_enabled]': number;
  'checkout[client_details][color_depth]': number;
  'checkout[client_details][java_enabled]': boolean;
  'checkout[client_details][browser_tz]': number;
}

export interface CaptchaData {
  required: boolean;
  token: string;
  sitekey: string;
  session: string;
  cookies?: string[];
}

export interface LoginPayload {
  form_type: string;
  utf8: string;
  'customer[email]': string;
  'customer[password]': string;
  return_url: string;
  'g-recaptcha-response'?: string;
}

export interface CartPayload {
  id: string;
  quantity: string;
  [key: string]: string;
}

export interface CheckoutData {
  url: string;
  token: string;
  paymentID?: string;
}

export interface CheckpointPayload {
  authenticity_token: string;
  'g-recaptcha-response': string;
  commit: string;
}

export interface CheckoutPayload {
  checkout: string;
  note: string;
  terms?: string;
  [updatesVariant: string]: string;
}

export interface ShippingPayload {
  authenticity_token: string;
  'checkout[shipping_rate][id]'?: string;
  [key: string]: string;
}

export interface CustomerPayload {
  _method: string;
  authenticity_token: string;
  previous_step: string;
  step: string;
  ['checkout[email]']: string;
  ['checkout[shipping_address][first_name]']: string;
  ['checkout[shipping_address][last_name]']: string;
  ['checkout[shipping_address][address1]']: string;
  ['checkout[shipping_address][address2]']: string;
  ['checkout[shipping_address][city]']: string;
  ['checkout[shipping_address][country]']: string;
  ['checkout[shipping_address][province]']: string;
  ['checkout[shipping_address][zip]']: string;
  ['checkout[shipping_address][phone]']: string;
  ['checkout[client_details][browser_width]']: string;
  ['checkout[client_details][browser_height]']: string;
  ['checkout[client_details][javascript_enabled]']: string;
}
export interface PaymentPayload {
  _method: string;
  authenticity_token: string;
  previous_step: string;
  step: string | undefined | null;
  s: string | undefined | null;
  ['checkout[email]']: string;
  ['checkout[credit_card][vault]']: string;
  ['checkout[different_billing_address]']: string;
  ['checkout[remember_me]']: number;
  ['checkout[vault_phone]']: string;
  ['checkout[total_price]']: string;
  complete: '1';
}
