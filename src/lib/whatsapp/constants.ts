export const GRAPH_VERSION = 'v21.0'

export function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`
}
