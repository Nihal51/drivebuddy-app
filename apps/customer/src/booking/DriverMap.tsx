import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { type DriverSpot, STALE_MS, minutesAgo, spotOfDriver, watchDriverSpot } from '@/data/tracking';
import { useI18n } from '@/i18n';
import { makeStyles, radius, space, useTheme } from '@/theme';

/**
 * Where this booking's driver is, live, while he shares it from the Driver
 * app (Start → Arrived); null before he starts. A point left by a driver the
 * booking was taken from does not count (spotOfDriver). `on`: only while a
 * driver is on the job.
 */
export function useDriverSpot(
  bookingId: string,
  driverId: string | undefined,
  on: boolean,
): DriverSpot | null {
  const [spot, setSpot] = useState<{ bookingId: string; spot: DriverSpot | null } | null>(null);
  useEffect(() => {
    if (!on) return;
    return watchDriverSpot(bookingId, (s) => setSpot({ bookingId, spot: s }));
  }, [bookingId, on]);
  return on && spot?.bookingId === bookingId ? spotOfDriver(spot.spot, driverId) : null;
}

/**
 * The driver moving on a map, while he shares his location from the
 * DriveBuddy Driver app (Start → Arrived). Nothing shows until he starts.
 * OpenStreetMap in a web view, like the pickup map: no key, no bill.
 */
export function DriverMap({ spot }: { spot: DriverSpot | null }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!spot || Platform.OS === 'web') return null;
  const stale = spot.active && now - spot.at.getTime() > STALE_MS;

  return (
    <Card tone="cream" style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={spot.active ? 'navigate' : 'flag'} size={18} color={colors.amberText} />
        <AppText variant="small" weight="heavy" color={colors.amberText}>
          {t.detail.live.title.toUpperCase()}
        </AppText>
      </View>
      <AppText weight="bold">{spot.active ? t.detail.live.onTheWay : t.detail.live.arrived}</AppText>
      <LiveMap spot={spot} />
      <AppText variant="tiny" color={colors.textMuted}>
        {t.detail.live.updated(minutesAgo(spot, now))}
      </AppText>
      {stale ? (
        <AppText variant="small" color={colors.textMuted}>
          {t.detail.live.stale}
        </AppText>
      ) : null}
    </Card>
  );
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

/** The map page: one car marker; window.moveTo(lat, lng) moves it and keeps it in view. */
export function liveMapHtml(lat: number, lng: number): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_SRI}" crossorigin="">
<style>html,body,#m{height:100%;margin:0}</style></head><body><div id="m"></div>
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_SRI}" crossorigin=""></script>
<script>
var m = L.map('m', { zoomControl: false }).setView([${lat}, ${lng}], 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
var icon = L.divIcon({ className: '', iconSize: [0, 0],
  html: '<div style="width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#F59E0B;border:4px solid #141210;box-shadow:0 0 0 6px rgba(245,158,11,.25)"></div>' });
var car = L.marker([${lat}, ${lng}], { icon: icon }).addTo(m);
window.moveTo = function (lat, lng) { car.setLatLng([lat, lng]); if (!m.getBounds().pad(-0.2).contains([lat, lng])) m.panTo([lat, lng]); };
</script></body></html>`;
}

function LiveMap({ spot }: { spot: DriverSpot }) {
  const { t } = useI18n();
  const styles = useStyles();
  const web = useRef<WebView>(null);
  // Made once, where the driver was when the map opened; later spots move the marker.
  const html = useMemo(
    () => liveMapHtml(spot.lat, spot.lng),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    web.current?.injectJavaScript(`window.moveTo && window.moveTo(${spot.lat}, ${spot.lng}); true;`);
  }, [spot.lat, spot.lng]);

  return (
    <View style={styles.map} accessibilityLabel={t.detail.live.mapLabel}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://thedrivebuddy.in' }}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        testID="driver-map"
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  map: { height: 220, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: c.creamLine },
}));
