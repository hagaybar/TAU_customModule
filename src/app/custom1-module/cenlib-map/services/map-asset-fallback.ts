import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AWS_CDN_BASE_URL } from '../config/data-source.config';
import { assetBaseUrl } from '../../../state/asset-base.generated';
import { dwarn } from '../../../services/debug.util';

/** Directory (under the shipped custom package) holding the bundled fallback copies. */
const LOCAL_ASSET_DIR = 'assets/cenlib-map';

/**
 * Map a CloudFront asset URL to its bundled, same-origin equivalent under
 * `src/assets/cenlib-map/`. Returns `null` when the URL is not a CDN asset we
 * ship a fallback for.
 *
 * This is the single source of truth for the CDN → bundled-fallback mapping,
 * shared by `ShelfMappingService` (mapping.csv) and `ShelfMapSvgComponent`
 * (floor SVGs). Output paths are always lowercase to match the CDN naming and
 * the committed files.
 */
export function cdnAssetToLocalPath(url: string): string | null {
  if (!url || !url.includes(AWS_CDN_BASE_URL)) {
    return null;
  }
  if (/\/data\/mapping\.csv(\?|$)/i.test(url)) {
    return `${LOCAL_ASSET_DIR}/mapping.csv`;
  }
  const floor = url.match(/\/maps\/floor_(\d+)\.svg(\?|$)/i);
  if (floor) {
    return `${LOCAL_ASSET_DIR}/floor_${floor[1]}.svg`;
  }
  return null;
}

/**
 * GET text from a CloudFront URL, falling back to the bundled same-origin copy
 * when the CDN request fails (outage, CORS regression, network error).
 *
 * If the URL has no bundled equivalent, or the fallback also fails, the error
 * propagates so callers keep their existing "no data" behavior (button hidden).
 */
export function fetchTextWithFallback(
  http: HttpClient,
  cdnUrl: string
): Observable<string> {
  return http.get(cdnUrl, { responseType: 'text' }).pipe(
    catchError((cdnError) => {
      const localPath = cdnAssetToLocalPath(cdnUrl);
      if (!localPath) {
        throw cdnError;
      }
      const localUrl = `${assetBaseUrl}/${localPath}`;
      dwarn(
        '[cenlib-map] CDN fetch failed; falling back to bundled asset:',
        localUrl
      );
      return http.get(localUrl, { responseType: 'text' });
    })
  );
}
