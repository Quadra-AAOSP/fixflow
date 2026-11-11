import { useRouter, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

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
       * Pop mode. The button pops the stack the screen belongs to (its own
       * navigator), not the global tab history; `popTo` is the last-resort
       * target used only when there is nothing to pop (a deep link, or a web
       * refresh that starts directly on this screen).
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
 * the previous screen, and `router.back()` follows the *root* history — which
 * for a stack nested inside a tab means "switch back to the tab I came from"
 * rather than "pop this stack". That left screens stranded on a tab's stack:
 * open notifications from Home, press back, land on Home — then tapping More
 * showed notifications again instead of the menu.
 *
 * `popTo` mode therefore rewrites the current screen to the stack's root
 * (`router.replace(popTo)`). It is deliberately *not* `router.back()`: when a
 * screen is pushed from another tab, that tab was focused first, so a history
 * back undoes the tab jump and lands on the previous tab while leaving the
 * pushed screen on this tab's stack. Replacing guarantees "back goes to this
 * section's root": notifications → More menu, order detail → shop, settings
 * → profile.
 */
export function HeaderBackButton({ color, to, popTo }: HeaderBackButtonProps) {
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('components.headerBack.a11yLabel')}
      hitSlop={12}
      className="pr-2"
      onPress={() => {
        if (to) {
          router.replace(to);
          return;
        }
        if (popTo) router.replace(popTo);
      }}
    >
      <ArrowLeft color={color} size={22} strokeWidth={2} />
    </Pressable>
  );
}
