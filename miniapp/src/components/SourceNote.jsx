import { getSource, getSources } from '../data/catalog.js';
import styles from './SourceNote.module.css';

const ruDate = (iso) => iso.split('-').reverse().join('.');

export default function SourceNote({ extra }) {
  const sources = getSources();
  const parts = [];
  if (sources.length > 0) {
    const kudago = sources.find((source) => source.id === 'kudago');
    const osm = sources.find((source) => source.id === 'osm');
    const demo = sources.find((source) => source.id === 'demo');
    if (kudago) parts.push(`Выставки и экскурсии — KudaGo${kudago.updatedAt ? ` на ${ruDate(kudago.updatedAt)}` : ''}`);
    if (osm) parts.push('кафе, бары и спортивные объекты — © участники OpenStreetMap, цены у них — оценка');
    if (demo) parts.push('часть событий и группы секций — тестовые');
  } else {
    const source = getSource();
    if (!source) return null;
    const date = source.updatedAt ? ` · данные на ${ruDate(source.updatedAt)}` : '';
    parts.push(`${source.isTest ? 'Тестовая афиша: события и цены вымышлены' : `Источник: ${source.name}`}${date}`);
  }
  const text = parts.join('; ');
  return (
    <p className={styles.note}>
      {text.charAt(0).toUpperCase() + text.slice(1)}
      {extra ? `. ${extra}` : ''}
    </p>
  );
}
