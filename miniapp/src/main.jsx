import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';
import Button from './components/Button.jsx';
import Lumi from './components/Lumi.jsx';
import Screen from './components/Screen.jsx';
import { loadCatalog } from './data/loadCatalog.js';
import { FALLBACK_PHOTO, PHOTOS } from './data/photos.js';

const SLOW_MS = 300;

function Boot() {
  const [status, setStatus] = useState('loading');
  const [slow, setSlow] = useState(false);

  const load = useCallback(() => {
    setStatus('loading');
    loadCatalog({ photos: PHOTOS, fallback: FALLBACK_PHOTO }).then(
      () => setStatus('ready'),
      () => setStatus('error')
    );
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'ready') return <App />;
  if (status === 'error') {
    return (
      <Screen
        title="Не получилось загрузить афишу"
        titleSize="md"
        subtitle="Проверьте соединение и попробуйте ещё раз."
        footer={<Button onClick={load}>Повторить</Button>}
      >
        <Lumi pose="sad" size={220} className="boot-lumi" />
      </Screen>
    );
  }
  return slow ? (
    <Screen title="Досуг" subtitle="Загружаем афишу…">
      <Lumi pose="fly" size={240} float className="boot-lumi" />
    </Screen>
  ) : null;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Boot />
  </StrictMode>
);
