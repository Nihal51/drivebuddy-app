import { type ReactNode, type RefObject, createContext, useContext, useMemo, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  type LayoutRectangle,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, space, useTheme } from '@/theme';

/** Room left above a field when the page scrolls it into view, so its label shows too. */
const REVEAL_MARGIN = 96;

type Revealer = (node: View | null) => void;

/**
 * Lets a field inside a Screen ask to be scrolled into view when it gets the
 * keyboard (components/TextField.tsx does), so the customer always sees what
 * they type — on every phone, whatever the keyboard covers.
 */
const RevealContext = createContext<Revealer | null>(null);
export const useReveal = () => useContext(RevealContext);

/**
 * A scrolling page with safe-area padding and keyboard handling, centred and
 * width-capped so it also reads well on tablets and the web preview. When the
 * keyboard opens, the page (and the pinned footer) moves up above it, and the
 * field being typed in scrolls into view.
 */
export function Screen({
  children,
  edges = ['top'],
  scrollRef,
  refreshing,
  onRefresh,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  edges?: Edge[];
  scrollRef?: RefObject<ScrollView | null>;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** Pinned below the scrolling content (e.g. a submit button). */
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  // The screen's own handle on the ScrollView when it passes one (book.tsx scrolls to errors).
  const ownScroll = useRef<ScrollView | null>(null);
  const scroll = scrollRef ?? ownScroll;
  const content = useRef<View | null>(null);

  const reveal = useMemo<Revealer>(
    () => (node) => {
      const scrollTo = () => {
        const target = content.current;
        if (!node || !target || !scroll.current) return;
        node.measureLayout(
          target,
          (_x: number, y: LayoutRectangle['y']) =>
            scroll.current?.scrollTo({ y: Math.max(0, y - REVEAL_MARGIN), animated: true }),
          () => {},
        );
      };
      // Wait for the keyboard (and the page shrinking above it) before measuring.
      if (Keyboard.isVisible()) {
        scrollTo();
        return;
      }
      const sub = Keyboard.addListener('keyboardDidShow', () => {
        sub.remove();
        clearTimeout(fallback);
        setTimeout(scrollTo, 60);
      });
      const fallback = setTimeout(() => {
        sub.remove();
        scrollTo();
      }, 500);
    },
    [scroll],
  );

  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      {/* "padding" on both platforms: Android draws edge to edge, so the window
          no longer shrinks for the keyboard by itself. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding" enabled={Platform.OS !== 'web'}>
        <RevealContext.Provider value={reveal}>
          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={Boolean(refreshing)}
                  onRefresh={onRefresh}
                  tintColor={colors.amber}
                  colors={[colors.amber]}
                />
              ) : undefined
            }
          >
            <View ref={content} style={styles.column}>
              {children}
            </View>
          </ScrollView>
        </RevealContext.Provider>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl * 2, alignItems: 'center' },
  column: { width: '100%', maxWidth: 640, gap: space.lg },
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.bar,
    alignItems: 'center',
  },
}));
