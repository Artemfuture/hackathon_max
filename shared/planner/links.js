const YANDEX_GO_REF = 'dosugkazan';
const YANDEX_GO_OPENS_WEBSITE = '25395763362139037';

const latLon = (point) => `${point.lat},${point.lon}`;

export function yandexMapsPointUrl(point) {
  const ll = `${point.lon},${point.lat}`;
  return `https://yandex.ru/maps/?ll=${ll}&pt=${ll}&z=16`;
}

export function yandexMapsRouteUrl(points, mode = 'walk') {
  const rtt = mode === 'taxi' ? 'auto' : mode === 'transit' ? 'mt' : 'pd';
  return `https://yandex.ru/maps/?mode=routes&rtext=${points.map(latLon).join('~')}&rtt=${rtt}`;
}

export function yandexGoUrl(from, to) {
  const params = [
    `start-lat=${from.lat}`,
    `start-lon=${from.lon}`,
    `end-lat=${to.lat}`,
    `end-lon=${to.lon}`,
    `ref=${YANDEX_GO_REF}`,
  ].join('&');
  return `https://3.redirect.appmetrica.yandex.com/route?${params}&appmetrica_tracking_id=${YANDEX_GO_OPENS_WEBSITE}`;
}
