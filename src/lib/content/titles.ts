interface TitleSource {
  productName: string;
  tagline: string;
}

/** The home page title: the product name and its subtitle, without the subtitle's closing full stop. */
export function overviewTitle(site: TitleSource): string {
  return `${site.productName}: ${site.tagline.replace(/\.$/, '')}`;
}

/** The title of any other page. */
export function pageTitle(site: Pick<TitleSource, 'productName'>, routeTitle: string): string {
  return `${routeTitle} · ${site.productName}`;
}
