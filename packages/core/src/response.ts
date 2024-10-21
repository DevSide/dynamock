export type CoreResponse = {
  status: number
  headers: { [key in string]: string }
  cookies: { [key in string]: string }
  query: { [key in string]: string }
  body: undefined | null | { [key in string]: unknown }
  filepath: string
}
