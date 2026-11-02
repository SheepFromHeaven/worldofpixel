import type { Sky } from './sky.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const SKY = capability<Sky>('sky');
export * from './sky.ts';
export * from './temperature.ts';
export * from './weatherMath.ts';
export * from './clouds.ts';
export * from './forcedWeather.ts';
export * from './lightning.ts';
export * from './pressureCentres.ts';
export * from './skyView.ts';
export * from './weatherGrid.ts';
export * from './weatherTextures.ts';
export { GroundSurface } from './groundSurface.ts';
export { Precipitation } from './precipitation.ts';
export { coriolisStrengthAt, PRESSURE_BELT_SHIFT_DEGREES, Winds, zonalPressureAt } from './winds.ts';
