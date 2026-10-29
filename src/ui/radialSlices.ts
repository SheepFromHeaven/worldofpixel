import type { TileIndex } from '../sim/grid.ts';
import { GAME_MODULES } from '../sim/modules/index.ts';
import type { Offer, OfferContext } from '../sim/offers.ts';
import type { Command } from '../sim/simulation.ts';
import type { Slice } from './radialMenu.ts';

export interface RadialActions {
  send(command: Command): void;
  inspect(index: TileIndex): void;
}

const OFFERS = GAME_MODULES.flatMap((module) => module.offers);

export function slicesFor(context: OfferContext, actions: RadialActions, index: TileIndex): Slice[] {
  const offers = OFFERS.flatMap((offered) => offered(context, index));
  const slice = (offer: Offer): Slice => ({ label: offer.label, reason: offer.reason, run: () => (offer.command ? actions.send(offer.command) : undefined) });
  const within = (group: Offer['group']): Offer[] => offers.filter((offer) => offer.group === group);

  const slices = within(undefined).map(slice);
  const erect = within('erect');
  if (erect.length > 0 && (context.mode === 'discover' || erect.some((offer) => offer.earned))) slices.push({ label: 'Erect', reason: null, run: () => undefined, children: erect.map(slice) });
  const orders = within('orders');
  if (orders.length > 0) slices.push({ label: 'Orders', reason: null, run: () => undefined, children: orders.map(slice) });
  slices.push({ label: 'Inspect Ground', reason: null, run: () => actions.inspect(index) });
  return slices;
}
