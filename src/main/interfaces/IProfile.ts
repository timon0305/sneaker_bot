interface IBilling {
  address: string;
  address2?: string;
  apt: string;
  city: string;
  country: string;
  countrycode: string;
  state: string;
  stateName: string;
  zip: string;
}
interface IShipping {
  address: string;
  address2?: string;
  apt: string;
  city: string;
  country: string;
  countrycode: string;
  state: string;
  stateName: string;
  zip: string;
}
export default interface IProfile {
  billing: IBilling;
  cardholdername: string;
  cardnumber: string;
  cvv: string;
  email: string;
  expdate: string;
  firstname: string;
  lastname: string;
  phone: string;
  cardtype: string;
  profilename: string;
  shipping: IShipping;
  usebilling: boolean;
}
