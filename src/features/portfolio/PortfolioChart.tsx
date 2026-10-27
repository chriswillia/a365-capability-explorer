import { useId } from 'react';
import { content } from '../../lib/content/index.ts';
import type { PortfolioCase } from '../../lib/portfolio/portfolio.ts';
import styles from './Portfolio.module.css';

export function PortfolioChart({ cases }: { cases: PortfolioCase[] }) {
  const id = useId();
  const copy = content.site.portfolio;
  const cutoffX = 70 + copy.intensityCutoff * 5;
  const cutoffY = 350 - (copy.valueCutoff - 1) * 70;
  return (
    <figure>
      <svg
        className={styles.chart}
        viewBox="0 0 640 420"
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>{copy.chart}</title>
        <desc id={`${id}-description`}>{copy.chartDescription}</desc>
        <rect x="70" y="70" width="500" height="280" className={styles.plot} />
        <path d={`M${cutoffX} 70V350 M70 ${cutoffY}H570`} className={styles.divider} />
        <text x="80" y="55">
          {copy.quadrants.accelerate}
        </text>
        <text x="560" y="55" textAnchor="end">
          {copy.quadrants.govern}
        </text>
        <text x="80" y="375">
          {copy.quadrants.experiment}
        </text>
        <text x="560" y="375" textAnchor="end">
          {copy.quadrants.reconsider}
        </text>
        <text x="320" y="410" textAnchor="middle">
          {content.site.mapping.intensity}
        </text>
        <text x="20" y="210" transform="rotate(-90 20 210)" textAnchor="middle">
          {content.questions.find((q) => q.id === 'businessValue')!.label}
        </text>
        {[0, 50, 100].map((n) => (
          <text key={n} x={70 + n * 5} y="395" textAnchor="middle">
            {n}%
          </text>
        ))}
        {[1, 2, 3, 4, 5].map((n) => (
          <text key={n} x="55" y={355 - (n - 1) * 70} textAnchor="end">
            {n}
          </text>
        ))}
        {cases
          .filter((item) => item.value !== null)
          .map((item) => {
            const x = 70 + item.result.intensity.overall * 5;
            const y = 350 - (item.value! - 1) * 70;
            const radius = Math.sqrt((item.userBand === null ? 1 : item.userBand + 1) * 100);
            return (
              <g key={item.assessment.id}>
                <title>
                  {item.number}. {item.name}
                </title>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  className={item.userBand === null ? styles.unknownBubble : styles.bubble}
                />
                <text className={styles.bubbleLabel} x={x} y={y + 5} textAnchor="middle">
                  {item.number}
                </text>
              </g>
            );
          })}
      </svg>
      <figcaption>{copy.chartDescription}</figcaption>
    </figure>
  );
}
