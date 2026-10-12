import type { ReactNode, Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

/**
 * A scrolling page with safe-area padding and keyboard handling, centred and
 * width-capped so it also reads well on tablets and the web preview.
 */
export function Screen({
  children,
  edges = ['top'],
  scrollRef,
  refreshing,
  onRefresh,
  contentStyle,
  background = colors.background,
  footer,
}: {
  children: ReactNode;
  edges?: Edge[];
  scrollRef?: Ref<ScrollView>;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  background?: string;
  /** Pinned below the scrolling content (e.g. a submit button). */
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.amber}
              />
            ) : undefined
          }
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl * 2, alignItems: 'center' },
  column: { width: '100%', maxWidth: 640, gap: space.lg },
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
});
