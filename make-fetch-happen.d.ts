interface FetchResult {
  json(): Promise<any>;
}

declare module "make-fetch-happen" {
  function fetch(url: string, options: any): Promise<FetchResult>;
  export = fetch;
}
