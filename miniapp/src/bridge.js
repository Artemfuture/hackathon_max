const app = () => (window.WebApp?.initData ? window.WebApp : null);

const BOT_NAME = import.meta.env.VITE_BOT_NAME;

export const getStartParam = () =>
  app()?.initDataUnsafe?.start_param ?? new URLSearchParams(window.location.search).get('startapp');

export const getUserName = () => app()?.initDataUnsafe?.user?.first_name ?? null;

export const isInMax = () => Boolean(app());

export function getProfile() {
  const user = app()?.initDataUnsafe?.user;
  if (!user) return null;
  const photo = typeof user.photo_url === 'string' && /^https:\/\//.test(user.photo_url) ? user.photo_url : null;
  return {
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Пользователь MAX',
    username: user.username ?? null,
    photo,
  };
}

export const botChatLink = () => (BOT_NAME ? `https://max.ru/${BOT_NAME}` : null);

export function openMaxLink(url) {
  if (app()?.openMaxLink) {
    Promise.resolve(app().openMaxLink(url)).catch(() => {});
    return;
  }
  window.open(url, '_blank', 'noopener');
}

export const getUserId = () => app()?.initDataUnsafe?.user?.id ?? null;

export const getInitData = () => app()?.initData ?? null;

export function launchLink(param) {
  return BOT_NAME
    ? `https://max.ru/${BOT_NAME}?startapp=${param}`
    : `${window.location.origin}${window.location.pathname}?startapp=${param}`;
}

export function setBackButton(onClick) {
  const button = app()?.BackButton;
  if (!button) return () => {};
  try {
    if (!onClick) {
      button.hide();
      return () => {};
    }
    button.onClick(onClick);
    button.show();
  } catch {
    return () => {};
  }
  return () => {
    try {
      button.offClick(onClick);
    } catch {}
  };
}

export function haptic(kind = 'selection') {
  const feedback = app()?.HapticFeedback;
  if (!feedback) return;
  try {
    const result =
      kind === 'success'
        ? feedback.notificationOccurred('success')
        : kind === 'impact'
          ? feedback.impactOccurred('light')
          : feedback.selectionChanged();
    Promise.resolve(result).catch(() => {});
  } catch {}
}

export async function shareText({ text, link }) {
  if (app()?.shareMaxContent) {
    await app().shareMaxContent({ text, link });
    return 'max';
  }
  if (navigator.share) {
    await navigator.share({ text, url: link });
    return 'system';
  }
  await navigator.clipboard.writeText([text, link].filter(Boolean).join('\n'));
  return 'clipboard';
}

export function openExternal(url) {
  if (app()?.openLink) {
    Promise.resolve(app().openLink(url)).catch(() => {});
    return;
  }
  window.open(url, '_blank', 'noopener');
}
