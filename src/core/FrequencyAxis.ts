import type { FrequencyAxisConfig, ThemeColors } from '../types';

/**
 * Static frequency-axis on the left side of the viewer.
 * Renders labels dynamically from `min`/`max` Hz or explicit values.
 */
export class FrequencyAxis {
  private el: HTMLElement;
  private width: number;
  private config: Required<Pick<FrequencyAxisConfig, 'min' | 'max' | 'labelCount'>>;
  private labels: number[] | 'auto';
  private formatLabel: (hz: number) => string;

  constructor(
    parent: HTMLElement,
    configInput: FrequencyAxisConfig | undefined,
    private spectrogramHeight: number,
    private theme: ThemeColors,
  ) {
    const cfg = configInput ?? {};
    this.width = cfg.width ?? 55;
    this.config = {
      min: cfg.min ?? 0,
      max: cfg.max ?? 125000,
      labelCount: cfg.labelCount ?? 6,
    };
    this.labels = cfg.labels ?? 'auto';
    this.formatLabel = cfg.formatLabel ?? FrequencyAxis.defaultFormat;

    this.el = document.createElement('div');
    this.el.className = 'sv-freq-axis';
    parent.insertBefore(this.el, parent.firstChild);

    this.applyStyles();
    this.render();
  }

  private applyStyles(): void {
    Object.assign(this.el.style, {
      width: `${this.width}px`,
      height: `${this.spectrogramHeight}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '5px 5px 5px 5px',
      fontSize: '11px',
      color: this.theme.freqAxisText,
      flexShrink: '0',
      alignSelf: 'flex-start',
      zIndex: '20',
      userSelect: 'none',
      boxSizing: 'border-box',
    });
  }

  private render(): void {
    this.el.innerHTML = '';
    const values = this.resolveLabels();

    for (let i = values.length - 1; i >= 0; i--) {
      const hz = values[i];
      const label = document.createElement('div');
      label.className = 'sv-freq-label';

      const isHighlight = this.isHighlightValue(hz);
      Object.assign(label.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        lineHeight: '1.1',
        color: isHighlight ? this.theme.freqAxisHighlight : this.theme.freqAxisText,
        fontWeight: isHighlight ? '600' : '400',
      });

      const formatted = this.formatLabel(hz);
      const parts = formatted.match(/^([\d.]+)\s*(.*)$/);
      if (parts) {
        const val = document.createElement('span');
        val.textContent = parts[1];
        val.style.fontSize = '12px';
        label.appendChild(val);

        if (parts[2]) {
          const unit = document.createElement('span');
          unit.textContent = parts[2];
          unit.style.fontSize = '9px';
          unit.style.opacity = '0.7';
          label.appendChild(unit);
        }
      } else {
        label.textContent = formatted;
      }

      this.el.appendChild(label);
    }
  }

  private resolveLabels(): number[] {
    if (Array.isArray(this.labels)) {
      return [...this.labels].sort((a, b) => a - b);
    }
    const { min, max, labelCount } = this.config;
    const step = (max - min) / (labelCount - 1);
    const vals: number[] = [];
    for (let i = 0; i < labelCount; i++) {
      vals.push(min + step * i);
    }
    return vals;
  }

  /** Highlight values that are "round" multiples of 25kHz or 50kHz. */
  private isHighlightValue(hz: number): boolean {
    if (hz === 0) return false;
    return hz % 50000 === 0;
  }

  static defaultFormat(hz: number): string {
    if (hz === 0) return '0 Hz';
    if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} KHz`;
    return `${hz} Hz`;
  }

  /** Update the axis when max frequency changes. */
  update(config: Partial<FrequencyAxisConfig>): void {
    if (config.min !== undefined) this.config.min = config.min;
    if (config.max !== undefined) this.config.max = config.max;
    if (config.labelCount !== undefined) this.config.labelCount = config.labelCount;
    if (config.labels !== undefined) this.labels = config.labels;
    if (config.formatLabel !== undefined) this.formatLabel = config.formatLabel;
    this.render();
  }

  getWidth(): number {
    return this.width;
  }

  destroy(): void {
    this.el.remove();
  }
}
