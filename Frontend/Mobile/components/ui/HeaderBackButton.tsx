import { useRouter, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable } from 'react-native';

type HeaderBackButtonProps = {
  /** Icon color — pass the active palette's ink. */
  color: string;
  /** the screen this stack's back arrow returns to (e.g. its list/root route). */
  to: Href;
};

/**
 * Explicit header back button for the nested stacks that live inside a tab
 * (More, Shop, Reports).
 *
 * The default header back control is unreliable here: on web it renders as a
 * link whose `href` resolves to the root's initial route (`/login`) rather than
 * the previous screen, and `router.back()` follows the *browser* history rather
 * than popping the nested stack — so tapping "back" either left the app or did
 * nothing. Navigating to an explicit target route is deterministic on every
 * platform.
 */
export function HeaderBackButton({ color, to }: HeaderBackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      className="pr-2"
      onPress={() => router.replace(to)}
    >
      <ArrowLeft color={color} size={22} strokeWidth={2} />
    </Pressable>
  );
}
