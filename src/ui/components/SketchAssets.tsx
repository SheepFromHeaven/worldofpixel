/**
 * One hidden SVG holding every sketch asset: the roughening filters that give flat CSS
 * boxes a drawn-by-hand wobble, and the element glyphs referenced by <use> elsewhere.
 * Mounted once per canvas; everything else points at these ids.
 */
export function SketchAssets() {
  return (
    <svg className="ec-assets" aria-hidden="true" focusable="false">
      <defs>
        {/* Long-wavelength, low-amplitude displacement reads as a confident hand.
            High frequency or high scale is what makes a line look shaky and childish. */}
        <filter id="ec-rough" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.3" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        <filter id="ec-rough-soft" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="19" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Silhouettes: a slow waver over a long run, never a wobble. */}
        <filter id="ec-contour" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="1" seed="31" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Texture and hatching: barely displaced, so dense line work stays legible. */}
        <filter id="ec-rough-fine" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="1" seed="53" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.45" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Paper tooth: a faint multiply layer so graphite sits in the grain. */}
        <filter id="ec-paper-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed="11" result="grain" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0.23  0 0 0 0 0.2  0 0 0 0 0.17  0 0 0 0.5 0"
          />
        </filter>

        <symbol id="ec-icon-earth" viewBox="0 0 24 24">
          <path d="M2.5 17.5 C 6 11.5, 10.5 9.5, 14 12.5 C 16 14.2, 18 14.6, 21.5 17.4" />
          <path d="M2 18.6 C 8 19.4, 16 19.3, 22 18.5" />
          <path d="M7 16.4 L 8.6 18.2 M11 14.6 L 12.4 16.6 M15 15.4 L 16.2 17.4" />
        </symbol>

        <symbol id="ec-icon-water" viewBox="0 0 24 24">
          <path d="M12 3.2 C 16.4 9.6, 18.4 12.6, 18.2 15.4 C 18 18.9, 15.3 21, 12 21 C 8.7 21, 6 18.9, 5.8 15.4 C 5.6 12.6, 7.6 9.6, 12 3.2 Z" />
          <path d="M9 16.4 C 9.2 18.2, 10.1 19.1, 11.4 19.4" />
        </symbol>

        <symbol id="ec-icon-fire" viewBox="0 0 24 24">
          <path d="M12 2.6 C 13.4 7, 16.8 8.8, 16.6 13.2 C 16.4 17.4, 14.1 20.4, 11.8 20.4 C 9.5 20.4, 7.2 17.8, 7.4 14 C 7.5 11.4, 9.4 10.2, 10.2 7.4 C 10.8 9.2, 11.4 9, 12 2.6 Z" />
          <path d="M11.9 13 C 13.2 14.6, 13.4 16.4, 12.4 17.8 C 11.2 17.2, 10.6 15.6, 11.9 13 Z" />
        </symbol>

        <symbol id="ec-icon-air" viewBox="0 0 24 24">
          <path d="M2.8 8.6 C 8 5.6, 13.4 5.4, 15.8 7.4 C 17.8 9.1, 16.4 12.1, 14 11.4" />
          <path d="M3.2 13 C 9 11.4, 15 11.6, 17 13.4" />
          <path d="M3.6 17.4 C 8.6 15.4, 14.6 16, 16.6 18 C 18 19.4, 16.4 21.6, 14.4 20.6" />
        </symbol>

        <symbol id="ec-icon-mud" viewBox="0 0 24 24">
          <path d="M3.4 15.4 C 4.4 11.4, 8.4 9.2, 11.8 10.4 C 15.2 11.6, 18.8 11, 20.4 14.6 C 21.4 16.9, 18.6 18.9, 12 19 C 5.4 19.1, 2.9 17.4, 3.4 15.4 Z" />
          <path d="M7.4 19.2 C 7.2 20.6, 7.6 21.4, 8.4 21.6 M15.6 19.1 C 15.6 20.4, 16.2 21.2, 17 21.3" />
          <path d="M8.4 14 C 9.6 13.4, 10.6 13.6, 11.2 14.4 M14 15.4 C 15 14.8, 16 15, 16.6 15.6" />
        </symbol>

        <symbol id="ec-icon-clay-block" viewBox="0 0 24 24">
          <path d="M3.4 7.6 C 9 7, 15.4 7.1, 20.6 7.5 C 21 10.6, 20.9 13.8, 20.5 16.6 C 14.8 17.2, 8.6 17.1, 3.5 16.5 C 3.1 13.6, 3.1 10.4, 3.4 7.6 Z" />
          <path d="M3.5 12.1 C 9.4 12.6, 15 12.5, 20.5 12.1" />
          <path d="M11.8 7.4 L 11.9 12.2 M7.6 12.4 L 7.5 16.8 M16.2 12.3 L 16.4 16.8" />
        </symbol>

        <symbol id="ec-icon-steam" viewBox="0 0 24 24">
          <path d="M7.6 20.4 C 9.6 17.4, 5.6 15.2, 7.6 12 C 9.2 9.4, 6.4 7.6, 8 4.4" />
          <path d="M12.4 20.8 C 14.4 17.6, 10.4 15.4, 12.4 12.2 C 14 9.6, 11.2 7.8, 12.8 4.6" />
          <path d="M17 20.2 C 19 17.2, 15 15, 17 11.8" />
        </symbol>

        <symbol id="ec-icon-spark" viewBox="0 0 24 24">
          <path d="M13.4 2.6 L 7.2 12.8 L 12 13.2 L 9.8 21.2 L 17 10.6 L 12.2 10.4 Z" />
        </symbol>

        <symbol id="ec-icon-dot" viewBox="0 0 24 24">
          <path d="M12 6.4 C 15.6 6.3, 18 8.8, 17.9 12.1 C 17.8 15.6, 15.4 17.8, 11.9 17.7 C 8.5 17.6, 6.1 15.4, 6.2 12 C 6.3 8.7, 8.6 6.5, 12 6.4 Z" />
        </symbol>
      </defs>
    </svg>
  );
}
