import styles from './Collage.module.css';

export default function Collage({ photos }) {
  return (
    <div className={styles.collage} style={{ gridTemplateColumns: `repeat(${photos.length}, 1fr)` }}>
      {photos.map(({ src, crop }, index) => (
        <div key={index} className={styles.tile}>
          <img
            src={src}
            alt=""
            style={
              crop
                ? { width: `${crop.w}%`, height: `${crop.h}%`, left: `${crop.left}%`, top: `${crop.top}%` }
                : { width: '100%', height: '100%', left: 0, top: 0, objectFit: 'cover' }
            }
          />
        </div>
      ))}
    </div>
  );
}
