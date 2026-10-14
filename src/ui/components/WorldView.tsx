import { Resources } from '../../engine/recipes.js';
import { useWorld, worldStore } from '../worldStore.js';
import { evaluateWorld } from '../worldStages.js';
import { ElementIcon } from './ElementIcon.js';
import { WorldScene } from './WorldScene.js';

export function WorldView({ active }: { active: boolean }) {
  const world = useWorld();
  const state = evaluateWorld(world.totals);
  const unlocked = state.progress.filter((entry) => entry.unlocked);
  const headline = unlocked.length ? unlocked[unlocked.length - 1]!.stage : null;

  return (
    <div className={active ? 'ec-world' : 'ec-world ec-world-hidden'} aria-hidden={!active}>
      <div className="ec-world-sheet">
        <WorldScene state={state} earth={world.totals.get(Resources.Earth) ?? 0} />
        <div className="ec-world-caption">
          <h2>{state.hasPlanet ? (headline?.title ?? 'A bare rock') : 'A drift of dust'}</h2>
          <p>
            {state.hasPlanet
              ? (headline?.blurb ?? '')
              : 'Pipe Earth into a World node and it will pull itself together.'}
          </p>
        </div>
      </div>

      <aside className="ec-world-tally">
        <h2>The world so far</h2>
        <p className="ec-world-count">{world.received} delivered</p>

        <ol className="ec-stage-list">
          {state.progress.map(({ stage, have, unlocked: done }) => (
            <li key={stage.id} className={done ? 'ec-stage-done' : 'ec-stage-todo'}>
              <ElementIcon resource={stage.resource} size={17} />
              <span className="ec-stage-title">{stage.title}</span>
              <span className="ec-stage-need">
                {done ? '✓' : `${Math.min(have, stage.needed)}/${stage.needed}`}
              </span>
            </li>
          ))}
        </ol>

        {state.next && (
          <p className="ec-world-next">
            Next: {state.next.stage.title} — needs{' '}
            {state.next.stage.needed - Math.min(state.next.have, state.next.stage.needed)} more{' '}
            {state.next.stage.resource}
            {state.next.stage.needsPlanet && !state.hasPlanet ? ', and a planet to put it on' : ''}
          </p>
        )}

        <h3>Delivered</h3>
        <ul className="ec-world-ledger">
          {world.entries.length === 0 && <li className="ec-world-none">nothing yet</li>}
          {world.entries.map(([resource, count]) => (
            <li key={resource}>
              <ElementIcon resource={resource} size={16} />
              <span className="ec-world-name">{resource}</span>
              <span className="ec-world-number">×{count}</span>
            </li>
          ))}
        </ul>

        {world.received > 0 && (
          <button className="ec-btn" onClick={() => worldStore.clear()}>
            Start a new world
          </button>
        )}
      </aside>
    </div>
  );
}
