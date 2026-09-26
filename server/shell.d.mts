/** index.html with the page's own head written in, and an ETag over the result. */
export declare function renderShell(html: string, page: { pathname: string; search: string; lookup: unknown }): { body: string; etag: string }
