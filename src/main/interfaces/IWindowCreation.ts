export default interface IWindowCreation {
  harvesterID: string;
  harvesterType: string;
  harvesterName: string;
  proxy: { username: string; password: string; proxyURL: string } | null;
}
