/**
 * Mensagens para o usuário: avisos rápidos (toast), anúncios para leitores
 * de tela e telas de erro amigáveis com "Tentar novamente".
 */

/** Aviso rápido no topo da tela. */
export function toast(message, { type = 'info', duration = 4200 } = {}) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const close = () => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener('click', close);
  setTimeout(close, duration);
  // no máximo 3 avisos de uma vez
  while (box.children.length > 3) box.firstElementChild.remove();
}

/** Fecha todos os avisos (ex.: ao abrir uma tela de resumo). */
export function clearToasts() {
  document.getElementById('toasts')?.replaceChildren();
}

let announceTimer = null;
/** Texto lido por leitores de tela (região aria-live). */
export function announce(message) {
  const live = document.getElementById('sr-live');
  if (!live) return;
  clearTimeout(announceTimer);
  live.textContent = '';
  announceTimer = setTimeout(() => { live.textContent = message; }, 60);
}

function isInAppBrowser() {
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|TikTok|Snapchat|GSA\//i.test(navigator.userAgent);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const PERMISSION_HELP = () => (isIOS()
  ? 'No iPhone/iPad (Safari): toque em <strong>aA</strong> na barra de endereço → <strong>Ajustes do Site</strong> → <strong>Câmera</strong> → <strong>Permitir</strong>. Depois toque em “Tentar novamente”.'
  : 'No Android (Chrome): toque no <strong>cadeado</strong> ao lado do endereço → <strong>Permissões</strong> → <strong>Câmera</strong> → <strong>Permitir</strong>. Depois toque em “Tentar novamente”.');

const ERRORS = {
  denied: {
    icon: 'camera',
    title: 'Precisamos acessar sua câmera',
    text: () => `para utilizar a Realidade Aumentada.<br><small>${PERMISSION_HELP()}</small>`,
  },
  notfound: {
    icon: 'camera',
    title: 'Não encontramos uma câmera',
    text: () => 'Use um celular ou tablet com câmera traseira — ou conecte uma webcam ao computador — e tente novamente.',
  },
  busy: {
    icon: 'camera',
    title: 'A câmera está ocupada',
    text: () => 'Outro aplicativo (videochamada, câmera...) está usando a câmera. Feche-o e tente novamente.',
  },
  ended: {
    icon: 'camera',
    title: 'A câmera foi desligada',
    text: () => 'Isso acontece quando a tela é bloqueada ou outro aplicativo usa a câmera. Toque para reativar.',
    retry: 'Reativar câmera',
  },
  insecure: {
    icon: 'cadeado',
    title: 'Conexão não segura',
    text: () => 'Por segurança, os navegadores só liberam a câmera em endereços <strong>https://</strong>. Abra o aplicativo pelo endereço oficial.',
  },
  unsupported: {
    icon: 'globo',
    title: 'Navegador sem acesso à câmera',
    text: () => (isInAppBrowser()
      ? 'Parece que o link foi aberto dentro de outro aplicativo. Toque em <strong>⋯</strong> e escolha <strong>“Abrir no navegador”</strong> (Chrome ou Safari).'
      : 'Use o <strong>Chrome</strong> (Android) ou o <strong>Safari</strong> (iPhone) atualizados.'),
  },
  webgl: {
    icon: 'cubo',
    title: 'Gráficos 3D indisponíveis',
    text: () => 'Este aparelho ou navegador não suporta WebGL, necessário para mostrar os animais em 3D. Tente atualizar o navegador.',
  },
  load: {
    icon: 'nuvem',
    title: 'Não foi possível carregar',
    text: () => 'Verifique sua conexão com a internet e tente novamente.',
  },
  camera: {
    icon: 'camera',
    title: 'Não foi possível abrir a câmera',
    text: () => 'Feche outros aplicativos que usam a câmera, verifique as permissões e tente novamente.',
  },
};

/**
 * Tela de erro sobre a experiência AR.
 * @param {{code?: string}} err
 */
export function showARError(err, { onRetry, screen }) {
  const info = ERRORS[err?.code] || ERRORS.camera;
  if (!ERRORS[err?.code]) console.error(err);
  const host = screen || document.body;
  host.querySelector('.ar-error')?.remove();
  const box = document.createElement('div');
  box.className = 'ar-error';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'ar-error-title');
  box.innerHTML = `
    <div class="ar-error__card sg-cartela sg-cartela--centro">
      <svg class="ico ar-error__icon" aria-hidden="true"><use href="#i-${info.icon}"/></svg>
      <h2 id="ar-error-title">${info.title}</h2>
      <p>${info.text()}</p>
      <div class="ar-error__actions">
        <a class="sg-btn sg-btn--pergaminho sg-cartela" href="#/">VOLTAR</a>
        <button type="button" class="sg-btn sg-btn--ambar sg-cartela" data-retry>${(info.retry || 'Tentar de novo').toUpperCase()}</button>
      </div>
    </div>`;
  box.querySelector('[data-retry]').addEventListener('click', () => {
    box.remove();
    onRetry?.();
  });
  box.querySelector('a').addEventListener('click', () => box.remove());
  host.appendChild(box);
  box.querySelector('[data-retry]').focus();
  announce(`${info.title}.`);
  return box;
}

/** Remove telas de erro abertas (ao sair da experiência). */
export function clearErrors(screen) {
  (screen || document).querySelectorAll('.ar-error').forEach((el) => el.remove());
}
