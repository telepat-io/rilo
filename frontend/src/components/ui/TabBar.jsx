import { Fragment } from 'react';

export function TabBar({ tabs, active, onChange }) {
  let spacerInserted = false;
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => {
        const needsSpacer = tab.align === 'right' && !spacerInserted;
        if (needsSpacer) spacerInserted = true;
        return (
          <Fragment key={tab.id}>
            {needsSpacer && <span className="tab-spacer" aria-hidden="true" />}
            <button
              role="tab"
              type="button"
              className={tab.id === active ? 'tab tab-active' : 'tab'}
              aria-selected={tab.id === active}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {tab.count != null && <span className="tab-count">{tab.count}</span>}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
