import { useRouter, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable } from 'react-native';

type HeaderBackButtonProps = {
  /** Icon color — pass the active palette's ink. */
  color: string;
} & (
  | {
      /**
       * the screen this stack's back arrow returns to (e.g. its list/root
       * route). Navigates with `router.replace` — deterministic on every
       * platform, which is what the stacks nested inside a tab need.
       */
      to: Href;
      popTo?: never;
    }
  | {
      to?: never;
      /**
       * Pop mode. The button calls `router.back()` so it simply unwinds the
       * stack the screen belongs to; `popTo` is the last-resort target used
       * only when there is nothing to pop (a deep link, or a web refresh that
       * starts directly on this screen).
       */
      popTo: Href;
    }
);

/**
 * Explicit header back button for the nested stacks that live inside a tab
 * (More, Shop, Reports, Profile).
 *
 * The default header back control is unreliable here: on web it renders as a
 * link whose `href` resolves to the root's initial route (`/login`) rather than
 * the previous screen, and `router.back()` follows the *browser* history rather
 * than popping the nested stack — so tapping "back" either left the app or did
 * nothing. Navigating to an explicit target route is deterministic on every
 * platform; `popTo` mode exists for stacks where the caller cannot name a
 * single correct destination ahead of time and popping is what the user means.
 */
export function HeaderBackButton({ color, to, popTo }: HeaderBackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      className="pr-2"
      onPress={() => {
        if (to) {
          router.replace(to);
          return;
        }
        if (router.canGoBack()) {
          router.back();
          return;
        }
        if (popTo) router.replace(popTo);
      }}
    >
      <ArrowLeft color={color} size={22} strokeWidth={2} />
    </Pressable>
  );
}
