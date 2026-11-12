// Small worked examples for the page guides: drawn with plain markup (no chart library), sized for the guide
// card, with made-up numbers that read like the studio's. Every value and label is passed in already
// translated. Colours come from the app's chart palette, so an example looks like the real thing.

// Columns made of stacked parts: [{ label, parts: [{ value, color }], note? }], `format` for the values,
// `highlight` = the label of the column the callout talks about.
export const ExColumns = ({ columns, legend = [], format = String, highlight, callout }) => {
    const max = Math.max(...columns.map((column) => column.parts.reduce((sum, part) => sum + part.value, 0)), 1);
    return (
        <div className="gxColumns">
            <div className="gxColumnsPlot">
                {columns.map((column) => {
                    const total = column.parts.reduce((sum, part) => sum + part.value, 0);
                    return (
                        <div key={column.label} className={`gxColumn${column.label === highlight ? ' isOn' : ''}`}>
                            <span className="gxColumnTotal">{format(total)}</span>
                            <span className="gxColumnStack" style={{ height: `${(total / max) * 100}%` }}>
                                {column.parts.map((part, index) => (
                                    <i key={index} style={{ flexGrow: part.value, background: part.color }} />
                                ))}
                            </span>
                            <span className="gxColumnLabel">{column.label}</span>
                        </div>
                    );
                })}
            </div>
            {legend.length > 0 && <ExLegend items={legend} />}
            {callout && <p className="gxCallout">{callout}</p>}
        </div>
    );
};

// Horizontal bars split into parts: [{ label, parts: [{ value, color }] }], each row's total at its end.
export const ExSplits = ({ rows, legend = [], callout }) => (
    <div className="gxSplits">
        {rows.map((row) => {
            const total = row.parts.reduce((sum, part) => sum + part.value, 0);
            return (
                <div key={row.label} className="gxSplit">
                    <span className="gxSplitLabel">{row.label}</span>
                    <span className="gxSplitBar">
                        {row.parts.map((part, index) => (
                            <i key={index} style={{ flexGrow: part.value, background: part.color }} title={String(part.value)} />
                        ))}
                    </span>
                    <span className="gxSplitTotal">{total}</span>
                </div>
            );
        })}
        {legend.length > 0 && <ExLegend items={legend} />}
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

// One bar per row: [{ label, value, tone? ('low' marks one that needs attention) }].
export const ExBars = ({ rows, color = '#2a78d6', callout }) => {
    const max = Math.max(...rows.map((row) => row.value), 1);
    return (
        <div className="gxBars">
            {rows.map((row) => (
                <div key={row.label} className={`gxBar${row.tone === 'low' ? ' isLow' : ''}`}>
                    <span className="gxBarLabel">{row.label}</span>
                    <span className="gxBarTrack">
                        <i style={{ width: `${(row.value / max) * 100}%`, background: row.tone === 'low' ? '#eda100' : color }} />
                    </span>
                    <span className="gxBarValue">{row.value}</span>
                </div>
            ))}
            {callout && <p className="gxCallout">{callout}</p>}
        </div>
    );
};

// A small table: head [..], rows [[..]]; the first column is the row header.
export const ExTable = ({ head, rows, callout }) => (
    <div className="gxTableWrap">
        <table className="gxTable">
            <thead>
                <tr>
                    {head.map((cell) => (
                        <th key={cell} scope="col">
                            {cell}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row[0]}>
                        {row.map((cell, index) =>
                            index === 0 ? (
                                <th key={index} scope="row">
                                    {cell}
                                </th>
                            ) : (
                                <td key={index}>{cell}</td>
                            )
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

// Tiles: [{ icon: Component, title, text, color? }] — what a page holds, at a glance.
export const ExTiles = ({ items }) => (
    <ul className="gxTiles">
        {items.map(({ icon: Icon, title, text, color }) => (
            <li key={title} style={color ? { '--gx-tone': color } : undefined}>
                <span className="gxTileIcon" aria-hidden="true">
                    <Icon />
                </span>
                <strong>{title}</strong>
                <span>{text}</span>
            </li>
        ))}
    </ul>
);

// A row of buttons/chips like the page's, the one to press marked: [{ label, on? }].
export const ExControls = ({ items, callout }) => (
    <div className="gxControls">
        <span className="gxSegment">
            {items.map((item) => (
                <span key={item.label} className={item.on ? 'isOn' : undefined}>
                    {item.label}
                </span>
            ))}
        </span>
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

// A key: a small sample of something on the page (a calendar block, a chip) beside what it means.
// rows: [{ sample: node, text }].
export const ExKey = ({ rows, callout }) => (
    <div className="gxKey">
        <ul>
            {rows.map((row, index) => (
                <li key={index}>
                    <span className="gxKeySample">{row.sample}</span>
                    <span className="gxKeyText">{row.text}</span>
                </li>
            ))}
        </ul>
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

// A block like the calendars draw: tone 'solid' | 'dashed' (waiting) | 'muted' (over / cancelled) | 'class'
// (a class session behind the bookings); `glow` = the red "not fully paid" border; badgeTone 'pending' | 'paid'.
export const ExBlock = ({ color = '#2a78d6', tone = 'solid', glow = false, time, title, badge, badgeTone }) => (
    <span className={`gxBlock tone-${tone}${glow ? ' isGlow' : ''}`} style={{ '--gx-accent': color }}>
        <b>{time}</b>
        <span className="gxBlockTitle">{title}</span>
        {badge && <span className={`gxBlockBadge${badgeTone ? ` is-${badgeTone}` : ''}`}>{badge}</span>}
    </span>
);

// A filter chip like the page's ("Awaiting approval 4"): icon, label, count; `on` = something waiting (amber).
export const ExChip = ({ icon: Icon, label, count, on = true }) => (
    <span className={`gxChip${on ? ' isOn' : ''}`}>
        {Icon && <Icon aria-hidden="true" />}
        <span className="gxChipLabel">{label}</span>
        {count !== undefined && <span className="gxChipCount">{count}</span>}
    </span>
);

// Label / value lines, like a receipt or a filled-in form: [{ label, sub?, value, tone? ('due' | 'good' | 'strong') }],
// an optional `title` line above them.
export const ExFields = ({ title, rows, callout }) => (
    <div className="gxFieldsWrap">
        <div className="gxFieldsCard">
            {title && <p className="gxFieldsTitle">{title}</p>}
            <dl className="gxFields">
                {rows.map((row) => (
                    <div key={row.label} className={`gxField${row.tone ? ` is-${row.tone}` : ''}`}>
                        <dt>
                            {row.label}
                            {row.sub && <small>{row.sub}</small>}
                        </dt>
                        <dd>{row.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

// A stretch of time split into zones, with a marker on it: zones [{ label, size, tone: 'full' | 'part' | 'none' }],
// marker { at (0–1), label }, ticks [{ at (0–1), label }] under the bar.
export const ExZones = ({ zones, marker, ticks = [], callout }) => (
    <div className="gxZonesWrap">
        <div className="gxZones">
            {marker && (
                <span className="gxZoneMarker" style={{ left: `${marker.at * 100}%` }}>
                    <span>{marker.label}</span>
                </span>
            )}
            <div className="gxZoneBar">
                {zones.map((zone) => (
                    <span key={zone.label} className={`gxZone is-${zone.tone}`} style={{ flex: `${zone.size} 1 0` }}>
                        {zone.label}
                    </span>
                ))}
            </div>
            {ticks.length > 0 && (
                <div className="gxZoneTicks">
                    {ticks.map((tick) => (
                        <span key={tick.label} style={{ left: `${tick.at * 100}%` }} className={tick.at >= 1 ? 'isEnd' : tick.at <= 0 ? 'isStart' : undefined}>
                            {tick.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

// A stat card like the dashboard's: icon, big value, label, and an optional note (noteTone 'bad' | 'good').
export const ExStat = ({ icon: Icon, value, label, note, noteTone, color = '#c42b2b' }) => (
    <span className="gxStat" style={{ '--gx-tone': color }}>
        {Icon && (
            <span className="gxStatIcon" aria-hidden="true">
                <Icon />
            </span>
        )}
        <span className="gxStatText">
            <strong>{value}</strong>
            <span>{label}</span>
            {note && <small className={noteTone ? `is-${noteTone}` : undefined}>{note}</small>}
        </span>
    </span>
);

// Rows like the page's lists: [{ id, lead / leadSub (a time), dot ('urgent' | 'normal' | 'later'), avatar (initials),
// title, sub, tag { label, tone: 'pending' | 'live' | 'good' | 'role' | 'late' | 'muted' }, value, actions [{ label, tone:
// 'approve' | 'reject', icon }], more (a small link line under the row) }].
export const ExList = ({ rows, callout }) => (
    <div className="gxListWrap">
        <ul className="gxList">
            {rows.map((row) => (
                <li key={row.id} className="gxListRow">
                    {row.lead && (
                        <span className="gxListLead">
                            <b>{row.lead}</b>
                            {row.leadSub && <small>{row.leadSub}</small>}
                        </span>
                    )}
                    {row.dot && <i className={`gxListDot is-${row.dot}`} aria-hidden="true" />}
                    {row.avatar && (
                        <span className="gxListAvatar" aria-hidden="true">
                            {row.avatar}
                        </span>
                    )}
                    <span className="gxListMain">
                        <span className="gxListTitle">{row.title}</span>
                        {row.sub && <span className="gxListSub">{row.sub}</span>}
                        {row.more && <span className="gxListMore">{row.more}</span>}
                    </span>
                    {row.tag && <span className={`gxTag is-${row.tag.tone ?? 'muted'}`}>{row.tag.label}</span>}
                    {row.value && <span className="gxListValue">{row.value}</span>}
                    {row.actions && (
                        <span className="gxListActions">
                            {row.actions.map(({ label, tone, icon: Icon }) => (
                                <span key={label} className={`gxAct is-${tone}`} title={label}>
                                    {Icon ? <Icon aria-hidden="true" /> : label}
                                </span>
                            ))}
                        </span>
                    )}
                </li>
            ))}
        </ul>
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

// Pills with counts, like the Activity page's areas: [{ label, count, on, icon }].
export const ExTags = ({ items, callout }) => (
    <div className="gxTagsWrap">
        <span className="gxTags">
            {items.map(({ label, count, on, icon: Icon }) => (
                <span key={label} className={`gxPill${on ? ' isOn' : ''}`}>
                    {Icon && <Icon aria-hidden="true" />}
                    {label}
                    {count !== undefined && <span className="gxPillCount">{count}</span>}
                </span>
            ))}
        </span>
        {callout && <p className="gxCallout">{callout}</p>}
    </div>
);

export const ExLegend = ({ items }) => (
    <ul className="gxLegend">
        {items.map((item) => (
            <li key={item.label}>
                <i style={{ background: item.color }} aria-hidden="true" />
                {item.label}
            </li>
        ))}
    </ul>
);
