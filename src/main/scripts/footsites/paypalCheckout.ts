import { uuid } from 'uuidv4';

export default class PaypalCheckout {
  paymentToken: string;
  ppToken: string;
  sessionId: string;
  constructor() {
    this.paymentToken = '';
    this.ppToken = '';
    this.sessionId = uuid();
  }

  async genToken() {}
}
