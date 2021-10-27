export interface StyleSize {
  name: string;
  id: number;
  stock_level: number;
}
export interface StylesApiProduct {
  id: number;
  name: string;
  image_url_hi: string;
  sizes: Array<StyleSize>;
}
export interface StockApiProduct {
  name: string;
  id: number;
  image_url: string;
  image_url_hi: string;
  price: number;
  sale_price: number;
  new_item: boolean;
  position: number;
  category_name: string;
}
export interface StockApiResponse {
  unique_image_url_prefixes: [];
  products_and_categories: { [key: string]: Array<StockApiProduct> };
}
export interface StylesApiResponse {
  styles: Array<StylesApiProduct>;
}
export interface SupremeProduct {
  name: string;
  id: number;
  url: string;
  image: string;
  colorName: string;
  colorId: number;
  sizeId: number;
  sizeName: string;
  price: number;
  productOOS: boolean;
}
export interface StylesMethodResponse {
  name: string;
  colorId: number;
  sizes: Array<StyleSize>;
}
export interface CartResponse {
  cart: Array<{ size_id: string; in_stock: boolean }>;
  success: boolean;
}
export interface CheckoutResponse {
  status: string;
  slug: string;
}
export interface StatusResponse {
  status: string;
  page: string;
}
