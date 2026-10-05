import { buildEvent, trackEvent, trackingEnabled, viewId, MIXPANEL_TRACK_URL } from './usage-tracking';

describe('usage-tracking — gating', () => {
  it('is on only with a token AND an enabled view', () => {
    expect(trackingEnabled({ token: 't', views: ['NDE_TEST'], view: 'NDE_TEST' })).toBeTrue();
    expect(trackingEnabled({ token: '', views: ['NDE_TEST'], view: 'NDE_TEST' })).toBeFalse();
    expect(trackingEnabled({ token: 't', views: ['NDE_TEST'], view: 'NDE' })).toBeFalse();
    expect(trackingEnabled({ token: 't', views: ['NDE_TEST'], view: '' })).toBeFalse();
  });
});

describe('usage-tracking — viewId', () => {
  it('turns a package id into a Primo vid', () => {
    expect(viewId('972TAU_INST-NDE_TEST')).toBe('972TAU_INST:NDE_TEST');
    expect(viewId('972TAU_INST-NDE')).toBe('972TAU_INST:NDE');
  });
});

describe('usage-tracking — buildEvent', () => {
  it('adds token, a fresh distinct_id and insert id, and keeps the properties', () => {
    const [a] = buildEvent('Shelf Map Open', { floor: '2' }, 'tok');
    const [b] = buildEvent('Shelf Map Open', { floor: '2' }, 'tok');
    expect(a.event).toBe('Shelf Map Open');
    expect(a.properties.token).toBe('tok');
    expect(a.properties['floor']).toBe('2');
    expect(a.properties.distinct_id).toBeTruthy();
    expect(a.properties.distinct_id).not.toBe(b.properties.distinct_id);
    expect(a.properties.$insert_id).not.toBe(a.properties.distinct_id);
  });
});

describe('usage-tracking — trackEvent', () => {
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    fetchSpy = spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(new Response('{"status":1,"error":null}'))
    );
  });

  it('sends nothing when disabled', () => {
    trackEvent('X', {}, { token: '', views: ['NDE_TEST'], view: 'NDE_TEST' });
    trackEvent('X', {}, { token: 't', views: ['NDE_TEST'], view: 'NDE' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends one form-encoded POST to the EU endpoint with ip=0 when enabled', () => {
    trackEvent('Shelf Map Open', { floor: '2' }, { token: 't', views: ['NDE_TEST'], view: 'NDE_TEST' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe(MIXPANEL_TRACK_URL);
    expect(url).toContain('api-eu.mixpanel.com');
    expect(url).toContain('ip=0');
    expect(init.method).toBe('POST');
    const data = JSON.parse((init.body as URLSearchParams).get('data')!);
    expect(data[0].event).toBe('Shelf Map Open');
    expect(data[0].properties.floor).toBe('2');
  });

  it('never throws, even if fetch itself throws', () => {
    fetchSpy.and.throwError('boom');
    expect(() =>
      trackEvent('X', {}, { token: 't', views: ['NDE_TEST'], view: 'NDE_TEST' })
    ).not.toThrow();
  });
});
