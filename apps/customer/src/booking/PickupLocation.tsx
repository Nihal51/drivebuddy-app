import { CITY_CENTRES, mapsLink, toPickupGeo, type PickupGeo } from '@drivebuddy/shared';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useI18n } from '@/i18n';
import { openUrl } from '@/lib/links';
import { makeStyles, radius, space, useTheme } from '@/theme';

type Status = 'idle' | 'locating' | 'denied' | 'failed';

/**
 * The exact pickup spot, under the typed address — optional, as on the
 * website. "Use my current location" asks for location permission (only now,
 * only once) and reads one GPS fix; the map (OpenStreetMap in a web view, no
 * key, no bill) opens on that spot or on the city, and the customer drags the
 * pin to the exact gate. The team gets a Google Maps link in the alert.
 */
export function PickupLocation({
  city,
  value,
  onChange,
}: {
  city: string;
  value: PickupGeo | null;
  onChange: (g: PickupGeo | null) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [status, setStatus] = useState<Status>('idle');
  const [mapOpen, setMapOpen] = useState(false);

  async function locate() {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('denied');
        setMapOpen(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const g = toPickupGeo(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
      setStatus(g ? 'idle' : 'failed');
      if (g) onChange(g);
    } catch {
      setStatus('failed');
    }
    setMapOpen(true);
  }

  return (
    <View style={styles.wrap} testID="pickup-location">
      <View style={styles.row}>
        <Button
          title={t.book.locate}
          icon="locate"
          variant="outline"
          compact
          loading={status === 'locating'}
          onPress={() => void locate()}
          testID="pickup-locate"
        />
        {!mapOpen && Platform.OS !== 'web' ? (
          <Button
            title={t.book.pinOnMap}
            variant="ghost"
            compact
            onPress={() => setMapOpen(true)}
            testID="pickup-open-map"
          />
        ) : null}
      </View>
      <AppText variant="tiny" color={colors.textMuted}>
        {t.book.locationOptional}
      </AppText>
      {status === 'denied' || status === 'failed' ? (
        <AppText variant="small" color={colors.textMuted}>
          {status === 'denied' ? t.book.locationDenied : t.book.locationFailed}
        </AppText>
      ) : null}

      {mapOpen && Platform.OS !== 'web' ? <PinMap city={city} value={value} onChange={onChange} /> : null}

      {value ? (
        <View style={styles.pinned} accessibilityLiveRegion="polite" testID="pickup-pinned">
          <AppText variant="small" weight="bold" color={colors.success}>
            {t.book.pinned(value.acc)}
          </AppText>
          <View style={styles.row}>
            <Button
              title={t.book.checkMap}
              variant="ghost"
              compact
              onPress={() => void openUrl(mapsLink(value))}
            />
            <Button
              title={t.book.removePin}
              variant="ghost"
              compact
              onPress={() => onChange(null)}
              testID="pickup-remove"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Leaflet 1.9.4 from unpkg, pinned by its published integrity hashes. */
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

/** The map page: one draggable pin; every move is posted back as { lat, lng }. */
function mapHtml(lat: number, lng: number, zoom: number): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_SRI}" crossorigin="">
<style>html,body,#m{height:100%;margin:0}</style></head><body><div id="m"></div>
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_SRI}" crossorigin=""></script>
<script>
var m = L.map('m').setView([${lat}, ${lng}], ${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
var icon = L.divIcon({ className: '', iconSize: [0, 0],
  html: '<div style="width:28px;height:28px;margin:-28px 0 0 -14px;border-radius:50% 50% 50% 0;background:#F59E0B;border:3px solid #141210;transform:rotate(-45deg)"></div>' });
var pin = L.marker([${lat}, ${lng}], { draggable: true, icon: icon }).addTo(m);
function send(p) { window.ReactNativeWebView.postMessage(JSON.stringify({ lat: p.lat, lng: p.lng })); }
pin.on('dragend', function () { send(pin.getLatLng()); });
m.on('click', function (e) { pin.setLatLng(e.latlng); send(e.latlng); });
window.setPin = function (lat, lng) { pin.setLatLng([lat, lng]); m.setView([lat, lng], Math.max(m.getZoom(), 17)); };
</script></body></html>`;
}

function PinMap({
  city,
  value,
  onChange,
}: {
  city: string;
  value: PickupGeo | null;
  onChange: (g: PickupGeo | null) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const web = useRef<WebView>(null);
  const last = useRef<PickupGeo | null>(value);
  // The page is made once, on the spot (or the city) the map opened on; later spots move the pin.
  const html = useMemo(() => {
    const start = value ?? CITY_CENTRES[city] ?? CITY_CENTRES.Raipur!;
    return mapHtml(start.lat, start.lng, value ? 17 : 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new GPS fix moves the pin (a spot that came from the map itself is already there).
  useEffect(() => {
    if (!value || value === last.current) return;
    last.current = value;
    if (value.acc !== undefined)
      web.current?.injectJavaScript(`window.setPin && window.setPin(${value.lat}, ${value.lng}); true;`);
  }, [value]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const p = JSON.parse(e.nativeEvent.data) as { lat?: unknown; lng?: unknown };
      // A pin placed by hand has no GPS accuracy.
      const g = toPickupGeo(p.lat, p.lng);
      if (g) {
        last.current = g;
        onChange(g);
      }
    } catch {
      /* not ours */
    }
  };

  return (
    <View>
      <View style={styles.map} accessibilityLabel={t.book.mapLabel}>
        <WebView
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://thedrivebuddy.in' }}
          onMessage={onMessage}
          nestedScrollEnabled
          setSupportMultipleWindows={false}
          javaScriptEnabled
          testID="pickup-map"
        />
      </View>
      <AppText variant="tiny" color={colors.textMuted} style={styles.hint}>
        {t.book.mapHint}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: space.sm, marginTop: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  map: { height: 240, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: c.line },
  hint: { marginTop: space.xs },
  pinned: { gap: 2 },
}));
