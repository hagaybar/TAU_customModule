import { of, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AWS_CDN_BASE_URL } from '../config/data-source.config';
import { assetBaseUrl } from '../../../state/asset-base.generated';
import { cdnAssetToLocalPath, fetchTextWithFallback } from './map-asset-fallback';

describe('cdnAssetToLocalPath', () => {
  it('maps the CDN mapping.csv URL to the bundled .txt path (Alma rejects .csv)', () => {
    expect(cdnAssetToLocalPath(`${AWS_CDN_BASE_URL}/data/mapping.csv`)).toBe(
      'assets/cenlib-map/mapping.txt'
    );
  });

  it('maps each CDN floor SVG URL to a lowercase bundled path', () => {
    expect(cdnAssetToLocalPath(`${AWS_CDN_BASE_URL}/maps/floor_0.svg`)).toBe(
      'assets/cenlib-map/floor_0.svg'
    );
    expect(cdnAssetToLocalPath(`${AWS_CDN_BASE_URL}/maps/floor_2.svg`)).toBe(
      'assets/cenlib-map/floor_2.svg'
    );
  });

  it('matches the floor SVG regardless of case in the source URL', () => {
    expect(cdnAssetToLocalPath(`${AWS_CDN_BASE_URL}/maps/Floor_1.SVG`)).toBe(
      'assets/cenlib-map/floor_1.svg'
    );
  });

  it('returns null for a non-CDN URL (no bundled equivalent)', () => {
    expect(cdnAssetToLocalPath('https://example.com/data/mapping.csv')).toBeNull();
  });

  it('returns null for a CDN URL that is not a known asset', () => {
    expect(cdnAssetToLocalPath(`${AWS_CDN_BASE_URL}/data/other.json`)).toBeNull();
  });
});

describe('fetchTextWithFallback', () => {
  const cdnUrl = `${AWS_CDN_BASE_URL}/data/mapping.csv`;
  const expectedLocalUrl = `${assetBaseUrl}/assets/cenlib-map/mapping.txt`;

  function httpSpy(): jasmine.SpyObj<HttpClient> {
    return jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
  }

  it('returns the CDN response and does not touch the fallback when the CDN succeeds', (done) => {
    const http = httpSpy();
    http.get.and.returnValue(of('cdn-body'));

    fetchTextWithFallback(http, cdnUrl).subscribe((text) => {
      expect(text).toBe('cdn-body');
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get.calls.argsFor(0)[0]).toBe(cdnUrl);
      done();
    });
  });

  it('falls back to the bundled same-origin asset when the CDN fails', (done) => {
    const http = httpSpy();
    http.get.and.returnValues(
      throwError(() => new Error('CORS blocked')),
      of('local-body')
    );

    fetchTextWithFallback(http, cdnUrl).subscribe((text) => {
      expect(text).toBe('local-body');
      expect(http.get).toHaveBeenCalledTimes(2);
      expect(http.get.calls.argsFor(1)[0]).toBe(expectedLocalUrl);
      done();
    });
  });

  it('errors when both the CDN and the bundled asset fail', (done) => {
    const http = httpSpy();
    http.get.and.returnValues(
      throwError(() => new Error('CORS blocked')),
      throwError(() => new Error('local 404'))
    );

    fetchTextWithFallback(http, cdnUrl).subscribe({
      next: () => done.fail('expected an error, got a value'),
      error: () => {
        expect(http.get).toHaveBeenCalledTimes(2);
        done();
      },
    });
  });

  it('does not attempt a fallback when the URL has no bundled equivalent', (done) => {
    const http = httpSpy();
    const foreignUrl = 'https://example.com/data/mapping.csv';
    http.get.and.returnValue(throwError(() => new Error('network')));

    fetchTextWithFallback(http, foreignUrl).subscribe({
      next: () => done.fail('expected an error, got a value'),
      error: () => {
        expect(http.get).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });
});
