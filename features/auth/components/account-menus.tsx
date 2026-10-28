import { cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import { signOut } from "../actions";
import { nameInitials } from "../initials";
import { AccountMenuFrame, AccountPhoto } from "./account-menu-frame";

const summaryClass =
  "inline-flex size-12 cursor-pointer list-none items-center justify-center rounded-full bg-transparent p-0 text-ink marker:content-none hover:bg-action-ghost-hover [&::-webkit-details-marker]:hidden";

const itemClass =
  "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left type-label text-ink no-underline hover:bg-action-ghost-hover";

const notificationsPanel = `${cardSurface} absolute right-0 z-40 mt-3 w-72 p-4 elevation-md`;
const profilePanel = `${cardSurface} absolute right-0 z-40 mt-3 w-80 p-4 elevation-md`;

function MenuCaret() {
  return <span aria-hidden="true" className="absolute -top-1.5 right-4 size-3 rotate-45 border-t border-l border-border bg-surface-card" />;
}

/** Messages, the bell and the profile circle. Only one panel stays open. */
export function AccountMenus({
  name,
  email,
  profileHref,
  photoSrc,
  showSettings,
  settingsHref,
}: {
  name: string;
  email: string;
  profileHref: string;
  photoSrc?: string;
  showSettings: boolean;
  settingsHref: string;
}) {
  const label = name || email;
  const initials = nameInitials(label);

  return (
    <AccountMenuFrame>
      {/* Messaging is its own module, still to come; the icon holds its place in the header. */}
      <details className="relative">
        <summary className={cx(summaryClass, "border-0")} aria-label="Messages">
          <Icon name="message" size={24} />
        </summary>
        <div className={notificationsPanel}>
          <MenuCaret />
          <p className="m-0 type-label">Messages</p>
          <p className="m-0 mt-3 type-body-sm text-ink-muted">Messaging is coming soon.</p>
        </div>
      </details>
      <details className="relative">
        <summary className={cx(summaryClass, "border-0")} aria-label="Notifications">
          <Icon name="bell" size={24} />
        </summary>
        <div className={notificationsPanel}>
          <MenuCaret />
          <p className="m-0 type-label">Notifications</p>
          <p className="m-0 mt-3 type-body-sm text-ink-muted">No notifications.</p>
        </div>
      </details>
      <details className="relative">
        <summary className={cx(summaryClass, "overflow-hidden border border-border-strong text-base font-semibold")} aria-label={`Account menu for ${label}`}>
          <AccountPhoto photoSrc={photoSrc} fallback={<span aria-hidden="true">{initials || <Icon name="user" size={22} />}</span>} />
        </summary>
        <div className={profilePanel}>
          <MenuCaret />
          <div className="flex items-center gap-3">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-sunken text-lg font-semibold text-ink" aria-hidden="true">
              <AccountPhoto photoSrc={photoSrc} large fallback={<span aria-hidden="true">{initials || <Icon name="user" size={28} />}</span>} />
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate font-semibold text-ink">{label}</p>
              {name ? <p className="m-0 truncate type-body-sm text-ink-muted">{email}</p> : null}
            </div>
          </div>
          <ul className="m-0 mt-4 list-none border-t border-border p-0 pt-2">
            <li>
              <a href={profileHref} className={itemClass}>
                <Icon name="user" size={18} />
                Profile
              </a>
            </li>
            {showSettings && (
              <li>
                <a href={settingsHref} className={itemClass}>
                  <Icon name="sliders" size={18} />
                  Settings
                </a>
              </li>
            )}
            <li>
              <form action={signOut}>
                <button type="submit" className={cx(itemClass, "border-0 bg-transparent")}>
                  <Icon name="log-out" size={18} />
                  Log out
                </button>
              </form>
            </li>
          </ul>
        </div>
      </details>
    </AccountMenuFrame>
  );
}
