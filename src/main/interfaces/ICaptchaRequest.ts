import { Cookie } from 'tough-cookie';

export default interface ICaptchaRequest {
  taskID: number;
  site: string;
  sitekey: string;
  harvesterType: string;
  session?: string;
  checkoutProxy?: string;
  cookies?: Cookie[];
  supremeHeadless?: boolean;
  datadome?: boolean;
}
