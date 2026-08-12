/**
 * Web implementation of `react-native-pager-view`.
 *
 * `react-native-pager-view` is iOS/Android only, so metro aliases the package
 * to this module when bundling for web (see metro.config.js). It keeps the
 * parts of the API the app and `react-native-collapsible-tab-view` rely on:
 * the `onPageScroll` / `onPageSelected` / `onPageScrollStateChanged` events
 * and the `setPage` / `setPageWithoutAnimation` / `setScrollEnabled` methods.
 *
 * Events are emitted with a `nativeEvent` payload so that Reanimated's web
 * event handlers (`useEvent`) receive the same shape they do on native.
 */
import {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type PageScrollState = "idle" | "dragging" | "settling";

type PagerViewProps = {
  children?: ReactNode;
  initialPage?: number;
  scrollEnabled?: boolean;
  orientation?: "horizontal" | "vertical";
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onPageScroll?: (
    event: NativeSyntheticEvent<{ position: number; offset: number }>,
  ) => void;
  onPageSelected?: (event: NativeSyntheticEvent<{ position: number }>) => void;
  onPageScrollStateChanged?: (
    event: NativeSyntheticEvent<{ pageScrollState: PageScrollState }>,
  ) => void;
  // Native-only props, accepted and ignored so call sites stay identical.
  overdrag?: boolean;
  pageMargin?: number;
  offscreenPageLimit?: number;
  overScrollMode?: string;
  keyboardDismissMode?: string;
  layoutDirection?: string;
};

export type PagerViewRef = {
  setPage: (page: number) => void;
  setPageWithoutAnimation: (page: number) => void;
  setScrollEnabled: (enabled: boolean) => void;
};

// How long the scroll position must stay put before a gesture counts as settled.
const SETTLE_DELAY = 90;

const emitted = <T,>(payload: T) =>
  ({ nativeEvent: payload }) as NativeSyntheticEvent<T>;

const PagerView = forwardRef<PagerViewRef, PagerViewProps>(
  (
    {
      children,
      initialPage = 0,
      scrollEnabled = true,
      orientation = "horizontal",
      style,
      testID,
      onPageScroll,
      onPageSelected,
      onPageScrollStateChanged,
    },
    ref,
  ) => {
    const horizontal = orientation !== "vertical";
    const pages = Children.toArray(children);
    const pageCount = Math.max(pages.length, 1);

    const scrollRef = useRef<ScrollView>(null);
    const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
    const pageSize = horizontal ? width : height;

    const [enabled, setEnabled] = useState(scrollEnabled);
    useEffect(() => setEnabled(scrollEnabled), [scrollEnabled]);

    const currentPage = useRef(initialPage);
    const scrollState = useRef<PageScrollState>("idle");
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didInitialScroll = useRef(false);

    const scrollToPage = useCallback(
      (page: number, animated: boolean) => {
        const target = clamp(page, 0, pageCount - 1);
        if (pageSize > 0) {
          const distance = target * pageSize;
          scrollRef.current?.scrollTo(
            horizontal
              ? { x: distance, y: 0, animated }
              : { x: 0, y: distance, animated },
          );
        }
        if (target !== currentPage.current) {
          currentPage.current = target;
          onPageSelected?.(emitted({ position: target }));
        }
      },
      [horizontal, onPageSelected, pageCount, pageSize],
    );

    useImperativeHandle(
      ref,
      () => ({
        setPage: (page: number) => scrollToPage(page, true),
        setPageWithoutAnimation: (page: number) => scrollToPage(page, false),
        setScrollEnabled: setEnabled,
      }),
      [scrollToPage],
    );

    // Jump to `initialPage` as soon as the pager has been measured.
    useEffect(() => {
      if (didInitialScroll.current || pageSize === 0 || initialPage === 0) {
        return;
      }
      didInitialScroll.current = true;
      const distance = clamp(initialPage, 0, pageCount - 1) * pageSize;
      scrollRef.current?.scrollTo(
        horizontal
          ? { x: distance, y: 0, animated: false }
          : { x: 0, y: distance, animated: false },
      );
    }, [horizontal, initialPage, pageCount, pageSize]);

    useEffect(
      () => () => {
        if (settleTimer.current) {
          clearTimeout(settleTimer.current);
        }
      },
      [],
    );

    const changeScrollState = useCallback(
      (next: PageScrollState) => {
        if (scrollState.current === next) {
          return;
        }
        scrollState.current = next;
        onPageScrollStateChanged?.(emitted({ pageScrollState: next }));
      },
      [onPageScrollStateChanged],
    );

    const settle = useCallback(() => {
      changeScrollState("idle");
      if (settleTimer.current) {
        settleTimer.current = null;
      }
    }, [changeScrollState]);

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (pageSize === 0) {
          return;
        }
        const { contentOffset } = event.nativeEvent;
        const distance = horizontal ? contentOffset.x : contentOffset.y;
        const exact = clamp(distance / pageSize, 0, pageCount - 1);
        const position = Math.min(Math.floor(exact), pageCount - 1);

        onPageScroll?.(emitted({ position, offset: exact - position }));

        const nearest = Math.round(exact);
        if (nearest !== currentPage.current) {
          currentPage.current = nearest;
          onPageSelected?.(emitted({ position: nearest }));
        }

        if (scrollState.current !== "dragging") {
          changeScrollState("settling");
        }
        if (settleTimer.current) {
          clearTimeout(settleTimer.current);
        }
        settleTimer.current = setTimeout(settle, SETTLE_DELAY);
      },
      [
        changeScrollState,
        horizontal,
        onPageScroll,
        onPageSelected,
        pageCount,
        pageSize,
        settle,
      ],
    );

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
      setSize((previous) =>
        previous.width === nextWidth && previous.height === nextHeight
          ? previous
          : { width: nextWidth, height: nextHeight },
      );
    }, []);

    return (
      <View style={[styles.container, style]} onLayout={handleLayout}>
        {pageSize > 0 && (
          <ScrollView
            ref={scrollRef}
            testID={testID}
            horizontal={horizontal}
            pagingEnabled
            scrollEnabled={enabled}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            onScrollBeginDrag={() => changeScrollState("dragging")}
            onScrollEndDrag={() => changeScrollState("settling")}
            style={styles.scroller}
            contentContainerStyle={
              horizontal ? styles.rowContent : styles.columnContent
            }
          >
            {pages.map((page, index) => (
              <View key={index} style={{ width, height }}>
                {page}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  },
);

PagerView.displayName = "PagerView";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  scroller: { flex: 1 },
  rowContent: { flexDirection: "row", alignItems: "stretch" },
  columnContent: { flexDirection: "column" },
});

export default PagerView;
