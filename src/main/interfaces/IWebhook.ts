export default interface IWebhook {
  purchaseType: string;
  productName: string;
  image: string;
  size: string;
  color?: string;
  paymentURL?: string;
  mode: string;
  profile: string;
  site: string;
  price?: string;
  admin?: any;
}
