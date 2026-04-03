import { HttpClient } from "../../http";
import { BOX_BASE_URL } from "./common";

export function getBoxClient(params: { box_api_key: string }): HttpClient {
  return new HttpClient({
    baseUrl: BOX_BASE_URL,
    qstashToken: params.box_api_key,
  });
}
