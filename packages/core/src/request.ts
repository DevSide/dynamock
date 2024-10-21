export type CoreRequest = {
  origin: string
  path: string
  method: string
  headers: { [key in string]: string }
  cookies: { [key in string]: string }
  query: { [key in string]: string }
  body: undefined | null | { [key in string]: string }
}
