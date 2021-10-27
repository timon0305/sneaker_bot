import * as rp from 'request-promise';

interface requestOptions {
  method?: string;
  uri: string;
  headers: object | string;
  form?: object;
  body?: string;
  proxy?: string | undefined;
  jar?: object;
}
interface httpResponse {
  err: boolean;
  body: string | undefined;
  headers: object | undefined;
  statusCode: number | undefined;
}

export default async function Handle(options: requestOptions): Promise<httpResponse> {
  return new Promise(async (resolve) => {
    try {
      //Handle Cookie Object JAR
      if (options.jar != undefined || options.jar != null) {
        var res = [];
        for (var i in options.jar) {
          res.push(`${i}=${options.jar[i]};`);
        }
        options.headers['Cookie'] = res.join(' ');
      }

      //Handle Headers
      let tlsResponse = await rp.post({
        uri: 'http://localhost:3005/wall',
        method: 'POST',
        form: options,
        simple: false,
      });

      if (tlsResponse === 'error') {
        return resolve({ err: true, body: undefined, headers: undefined, statusCode: undefined });
      }

      //Build Response
      const Response = {
        err: false,
        body: tlsResponse.split('{body}')[1].split('{/body}')[0],
        statusCode: parseInt(tlsResponse.split('{statusCode}')[1].split('{/statusCode}')[0]),
        headers: tlsResponse.split('{headers}')[1].split('{/headers}')[0],
      };

      //Format The Headers
      const o = JSON.parse(Response.headers);
      for (const i in o) {
        if (o[i].length === 1 && i.toLowerCase() != 'set-cookie') {
          o[i] = o[i].join('');
        }
        if (i.toLowerCase() === 'set-cookie') {
          o[i].forEach((cookie) => {
            cookie = cookie.split(';')[0];
            options.jar[cookie.split('=')[0]] = cookie.replace(`${cookie.split('=')[0]}=`, '');
          });
        }
      }
      Response.headers = o;
      resolve(Response);
    } catch (_) {
      console.log(_.message);
      resolve({ err: true, body: undefined, headers: undefined, statusCode: undefined });
    }
  });
}
