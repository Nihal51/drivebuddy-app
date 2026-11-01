import {
  type AppConfig,
  CITIES,
  type City,
  type PackageId,
  type TripPackage,
  packagePrice,
  planTrip,
  rupees,
} from '@drivebuddy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import {
  type Category,
  type CategoryId,
  CATEGORIES,
  categoryPrice,
  categoryRoute,
} from '@/booking/categories';
import { placeName } from '@/booking/TripSection';
import { AppText } from '@/components/AppText';
import { BrandMark, Notice } from '@/components/bits';
import type { IconName } from '@/components/Button';
import { ContactActions } from '@/components/ContactActions';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { useConfig } from '@/config/ConfigProvider';
import { type Messages, useI18n } from '@/i18n';
import { kmText, priceLabel } from '@/i18n/format';
import { readStored, writeStored } from '@/lib/storage';
import { TOUCH, cardShadow, makeStyles, radius, space, useTheme } from '@/theme';

/** The four ways most customers book, as tabs on the main card; everything else below it. */
const TABS = ['hourly', 'day', 'drop', 'outstation'] as const satisfies readonly CategoryId[];
type Tab = (typeof TABS)[number];

/** The trip tabs and the package each one books. */
const TRIP_TAB: Partial<Record<Tab, TripPackage>> = { drop: 'one-way-drop', outstation: 'outstation' };

/** Places people book most, in this order; the pickup city itself is left out. */
const POPULAR = ['raipur', 'bilaspur', 'korba', 'nagpur'];

const CITY_KEY = 'home.city';

const category = (id: CategoryId) => CATEGORIES.find((c) => c.id === id) as Category;

/**
 * Home: a dark top with the pickup city, a card with the four main ways to
 * book (by the hour, full day, one-way drop, outstation) and prices worked
 * out for that city, then the other services, why DriveBuddy, and a call.
 * Every tap opens the booking at the right step, with the city (and the
 * place, if one was tapped) already filled in.
 */
export default function HomeScreen() {
  const { t } = useI18n();
  const { config } = useConfig();
  const { profile } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const firstName = profile?.name.split(' ')[0];
  const [city, setCity] = useState<City>('Raipur');
  const [tab, setTab] = useState<Tab>('drop');

  // The city the customer picked last time.
  useEffect(() => {
    let live = true;
    void readStored(CITY_KEY).then((c) => {
      if (live && c && (CITIES as readonly string[]).includes(c)) setCity(c as City);
    });
    return () => {
      live = false;
    };
  }, []);
  const pickCity = (c: City) => {
    setCity(c);
    void writeStored(CITY_KEY, c);
  };

  // Light status bar icons over the dark top, while Home shows.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  const open = (c: Category, extra: Record<string, string> = {}) => {
    const route = categoryRoute(c);
    router.push({ ...route, params: { ...route.params, city, ...extra } });
  };
  const more = CATEGORIES.filter((c) => !(TABS as readonly string[]).includes(c.id));

  const top = (
    <View style={styles.top}>
      <View style={styles.topInner}>
        <View style={styles.row}>
          <BrandMark onDark />
          <LanguageToggle size="small" />
        </View>
        <View style={styles.fast}>
          <Ionicons name="flash" size={12} color={colors.onAmber} />
          <AppText variant="tiny" weight="heavy" color={colors.onAmber}>
            {t.home.fast}
          </AppText>
        </View>
        <View testID="home-welcome">
          <AppText variant="small" weight="bold" color={colors.onHeroMuted}>
            {firstName ? t.home.greeting(firstName) : t.home.welcome}
          </AppText>
          <AppText variant="title" weight="heavy" color={colors.onHero} accessibilityRole="header">
            {t.home.title}
          </AppText>
        </View>
        <View style={styles.cityBlock}>
          <AppText variant="tiny" weight="heavy" color={colors.onHeroMuted} style={styles.label}>
            {t.home.pickupCity.toUpperCase()}
          </AppText>
          <View style={styles.cities} accessibilityRole="radiogroup">
            {CITIES.map((c) => {
              const selected = c === city;
              return (
                <Pressable
                  key={c}
                  testID={`home-city-${c}`}
                  onPress={() => pickCity(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[styles.city, selected ? styles.citySelected : null]}
                >
                  <AppText variant="small" weight="bold" color={selected ? colors.onAmber : colors.onHero}>
                    {t.cities[c]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <Screen top={top}>
      <View style={styles.card}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((id) => {
            const selected = id === tab;
            return (
              <Pressable
                key={id}
                testID={`tab-${id}`}
                onPress={() => setTab(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.tab, selected ? styles.tabSelected : null]}
              >
                <Ionicons
                  name={category(id).icon}
                  size={22}
                  color={selected ? colors.text : colors.textMuted}
                />
                <AppText
                  variant="tiny"
                  weight={selected ? 'heavy' : 'medium'}
                  color={selected ? colors.text : colors.textMuted}
                  numberOfLines={1}
                >
                  {t.home.tabs[id]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <TabBody tab={tab} city={city} open={open} />
      </View>

      {config.notice.show && config.notice.text ? <Notice text={config.notice.text} /> : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <AppText variant="heading" weight="heavy" accessibilityRole="header">
            {t.home.moreServices}
          </AppText>
          <Pressable
            testID="home-see-all"
            onPress={() => router.push({ pathname: '/book', params: { city } })}
            accessibilityRole="link"
            hitSlop={12}
          >
            <AppText variant="small" weight="bold" color={colors.amberText}>
              {t.home.seeAll}
            </AppText>
          </Pressable>
        </View>
        <View style={styles.services}>
          {more.map((c) => (
            <ServiceSquare key={c.id} category={c} onPress={() => open(c)} />
          ))}
        </View>
      </View>

      <Trust />

      <View style={styles.help}>
        <View>
          <AppText weight="heavy">{t.home.helpTitle}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t.home.helpBody}
          </AppText>
        </View>
        <ContactActions compact />
      </View>
    </Screen>
  );
}

type Open = (c: Category, extra?: Record<string, string>) => void;

/** Under the tabs: "Where to?" and popular places for a trip; the packages and their prices otherwise. */
function TabBody({ tab, city, open }: { tab: Tab; city: City; open: Open }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const c = category(tab);
  const pkg = TRIP_TAB[tab];

  if (!pkg) {
    return (
      <View style={styles.body}>
        {c.packages.map((id: PackageId) => (
          <Line
            key={id}
            testID={`home-package-${id}`}
            icon={c.icon}
            title={t.packages[id].name}
            detail={t.packages[id].blurb}
            price={priceLabel(t, packagePrice(config, id))}
            onPress={() => open(c, { package: id })}
          />
        ))}
        <Pressable
          testID="home-book"
          onPress={() => open(c)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.bookNow, pressed ? styles.bookNowPressed : null]}
        >
          <AppText weight="heavy" color={colors.onAmber}>
            {t.home.bookNow}
          </AppText>
        </Pressable>
      </View>
    );
  }

  const places = popular(config, pkg, city);
  return (
    <View style={styles.body}>
      <Pressable
        testID="home-where-to"
        onPress={() => open(c)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.where, pressed ? styles.wherePressed : null]}
      >
        <Ionicons name="search" size={20} color={colors.text} />
        <AppText variant="heading" weight="bold" style={styles.grow}>
          {t.home.whereTo}
        </AppText>
        <View style={styles.now}>
          <Ionicons name="time" size={14} color={colors.text} />
          <AppText variant="small" weight="bold">
            {t.home.now}
          </AppText>
        </View>
      </Pressable>
      {places.length > 0 ? (
        <AppText
          variant="tiny"
          weight="heavy"
          color={colors.textMuted}
          style={[styles.label, styles.popular]}
        >
          {t.home.popularFrom(t.cities[city]).toUpperCase()}
        </AppText>
      ) : null}
      {places.map((p) => (
        <Line
          key={p.id}
          testID={`home-place-${p.id}`}
          icon="location"
          title={p.name(t)}
          detail={`${t.packages[pkg].name} · ${kmText(t, p.km)}`}
          price={t.price.from(rupees(p.from))}
          onPress={() => open(c, { dest: p.id })}
        />
      ))}
    </View>
  );
}

/** Up to three popular places from the city, each with the lowest estimate (leaving at the usual hour). */
function popular(config: AppConfig, pkg: TripPackage, city: City) {
  return POPULAR.flatMap((id) => {
    const plan = planTrip(config, pkg, city, id);
    if (!plan.dest || plan.sameCity || !plan.est || plan.km <= 0) return [];
    const dest = plan.dest;
    return [{ id, km: plan.km, from: plan.est.from, name: (t: Messages) => placeName(t, dest) }];
  }).slice(0, 3);
}

function Line({
  testID,
  icon,
  title,
  detail,
  price,
  onPress,
}: {
  testID: string;
  icon: IconName;
  title: string;
  detail: string;
  price: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}, ${price}`}
      style={({ pressed }) => [styles.line, pressed ? styles.linePressed : null]}
    >
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={styles.grow}>
        <AppText variant="small" weight="bold" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="tiny" color={colors.textMuted} numberOfLines={1}>
          {detail}
        </AppText>
      </View>
      <AppText variant="small" weight="heavy">
        {price}
      </AppText>
    </Pressable>
  );
}

/** One of the other services: an icon in a square, its name and price. */
function ServiceSquare({ category: c, onPress }: { category: Category; onPress: () => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { colors } = useTheme();
  const styles = useStyles();
  const name = t.categories[c.id].name;
  const price = categoryPrice(t, config, c);
  const look =
    c.id === 'night'
      ? { box: styles.squareDark, icon: colors.featureAccent }
      : c.id === 'hospital'
        ? { box: styles.squareUrgent, icon: colors.danger }
        : { box: null, icon: colors.amberText };
  return (
    <Pressable
      testID={`tile-${c.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${price}`}
      accessibilityHint={t.categories[c.id].blurb}
      style={({ pressed }) => [styles.service, pressed ? styles.servicePressed : null]}
    >
      <View style={[styles.square, look.box]}>
        <Ionicons name={c.icon} size={26} color={look.icon} />
      </View>
      <AppText variant="tiny" weight="bold" style={styles.center} numberOfLines={2}>
        {name}
      </AppText>
      <AppText variant="tiny" color={colors.textMuted} style={styles.center} numberOfLines={2}>
        {price}
      </AppText>
    </Pressable>
  );
}

/** Six reasons to book, three to a row. */
function Trust() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const items: { icon: IconName; label: string }[] = [
    { icon: 'shield-checkmark', label: t.home.trust.verified },
    { icon: 'flash', label: t.home.trust.fast },
    { icon: 'call', label: t.home.trust.allDay },
    { icon: 'ribbon', label: t.home.trust.experienced },
    { icon: 'wallet', label: t.home.trust.payAfter },
    { icon: 'pulse', label: t.home.trust.status },
  ];
  return (
    <View style={styles.trust} accessibilityLabel={t.home.whyTitle} testID="home-trust">
      {items.map((i) => (
        <View key={i.label} style={styles.trustItem}>
          <Ionicons name={i.icon} size={20} color={colors.amberText} />
          <AppText variant="tiny" weight="bold" color={colors.textMuted} style={styles.center}>
            {i.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  top: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: c.hero,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    // Room for the card that overlaps the bottom of the dark top.
    paddingBottom: space.xxl + space.xl,
    marginBottom: -(space.xxl + space.sm),
  },
  topInner: { width: '100%', maxWidth: 640, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  fast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: c.amber,
  },
  cityBlock: { gap: space.xs + 2 },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  city: {
    minHeight: 40,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: c.heroSoft,
  },
  citySelected: { backgroundColor: c.amber },
  label: { letterSpacing: 0.6 },
  card: {
    backgroundColor: c.background,
    borderRadius: radius.lg + 2,
    borderWidth: 1,
    borderColor: c.line,
    overflow: 'hidden',
    ...cardShadow(c),
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingTop: space.md + 2,
    paddingBottom: space.md,
    paddingHorizontal: 2,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minHeight: TOUCH,
  },
  tabSelected: { borderBottomColor: c.amber },
  body: { padding: space.md + 2, gap: space.xs },
  where: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    minHeight: 56,
    paddingLeft: space.md + 2,
    paddingRight: space.sm,
    borderRadius: radius.md + 2,
    backgroundColor: c.surface,
  },
  wherePressed: { backgroundColor: c.surfacePressed },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.sm,
    borderRadius: radius.sm + 2,
    backgroundColor: c.amberSoft,
  },
  popular: { marginTop: space.sm, marginLeft: space.xs + 2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.xs + 2,
    borderRadius: radius.sm,
  },
  linePressed: { backgroundColor: c.surface },
  bookNow: {
    minHeight: 52,
    marginTop: space.sm,
    borderRadius: radius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.amber,
  },
  bookNowPressed: { backgroundColor: c.amberPressed },
  grow: { flex: 1 },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  services: { flexDirection: 'row', gap: space.sm },
  service: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: space.xs, borderRadius: radius.md },
  servicePressed: { opacity: 0.7 },
  square: {
    width: 64,
    height: 64,
    borderRadius: radius.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.amberSoft,
  },
  squareDark: { backgroundColor: c.hero },
  squareUrgent: { backgroundColor: c.dangerSoft },
  center: { textAlign: 'center' },
  trust: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
  },
  trustItem: { width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: space.xs },
  help: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface },
}));
